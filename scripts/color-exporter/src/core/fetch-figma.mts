import { invariant } from './assertions.mjs';
import { COLOR_EXPORTER_FILE_KEY, COLOR_EXPORTER_REST_URL } from './figma-source.mjs';
import type { FigmaFetch, FigmaResponseLike, WaitImplementation } from './types.mjs';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;

class AttemptTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`превышен тайм-аут ${timeoutMs} мс`);
        this.name = 'AttemptTimeoutError';
    }
}

class TransportError extends Error {
    constructor(cause: unknown) {
        super(cause instanceof Error ? cause.message : String(cause), { cause });
        this.name = 'TransportError';
    }
}

class InvalidJsonError extends Error {
    constructor(cause: unknown) {
        super(cause instanceof Error ? cause.message : String(cause), { cause });
        this.name = 'InvalidJsonError';
    }
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function redactSecret(message: unknown, secret: string): string {
    return String(message).replaceAll(secret, '[секрет скрыт]');
}

interface RequestOnceOptions {
    token: string;
    fetchImplementation: FigmaFetch;
    timeoutMs: number;
}

interface AttemptResult {
    response: FigmaResponseLike;
    data?: unknown;
}

/**
 * Один таймер охватывает и получение заголовков, и чтение JSON-тела.
 * Promise.race нужен дополнительно к AbortController: тестовый или сторонний
 * клиент может проигнорировать сигнал отмены и оставить Promise незавершённым.
 */
async function requestOnce({
    token,
    fetchImplementation,
    timeoutMs,
}: RequestOnceOptions): Promise<AttemptResult> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
            controller.abort();
            reject(new AttemptTimeoutError(timeoutMs));
        }, timeoutMs);
    });

    try {
        let response: FigmaResponseLike;
        try {
            response = await Promise.race([
                fetchImplementation(COLOR_EXPORTER_REST_URL, {
                    headers: { 'X-FIGMA-TOKEN': token },
                    signal: controller.signal,
                    // Секрет разрешён только постоянному адресу Figma, не перенаправлениям.
                    redirect: 'error',
                }),
                timeout,
            ]);
        } catch (error) {
            throw new TransportError(error);
        }

        invariant(
            response && typeof response.ok === 'boolean' && Number.isInteger(response.status),
            'Figma REST вернул объект ответа неправильного формата',
        );
        if (!response.ok) return { response };

        try {
            const data = await Promise.race([response.json(), timeout]);
            return { response, data };
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new InvalidJsonError(error);
            }
            throw new TransportError(error);
        }
    } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        // В ошибочном ответе тело не читается: отмена освобождает соединение
        // перед повторной попыткой, а не оставляет незавершённый поток.
        controller.abort();
    }
}

function readRetryAfter(response: FigmaResponseLike): string | undefined {
    try {
        const value = response.headers?.get('retry-after');
        return value === null ? undefined : value;
    } catch {
        return undefined;
    }
}

function retryDelay(
    response: FigmaResponseLike,
    attempt: number,
    nowImplementation: () => number,
): number {
    const fallback = INITIAL_RETRY_DELAY_MS * (2 ** (attempt - 1));
    const retryAfter = readRetryAfter(response)?.trim();
    if (!retryAfter) return Math.min(fallback, MAX_RETRY_DELAY_MS);

    let milliseconds: number | undefined;
    if (/^\d+$/.test(retryAfter)) {
        milliseconds = Number(retryAfter) * 1_000;
    } else {
        const timestamp = Date.parse(retryAfter);
        if (Number.isFinite(timestamp)) {
            milliseconds = Math.max(0, timestamp - nowImplementation());
        }
    }
    if (milliseconds === undefined) {
        return Math.min(fallback, MAX_RETRY_DELAY_MS);
    }
    return milliseconds;
}

export interface FetchFigmaFileOptions {
    token: string | undefined;
    fetchImplementation?: FigmaFetch;
    timeoutMs?: number;
    attempts?: number;
    waitImplementation?: WaitImplementation;
    nowImplementation?: () => number;
}

/**
 * Получает полный файл через Figma REST API. Figma MCP здесь не используется.
 * Временные сетевые ошибки повторяются ограниченное число раз; токен никогда
 * не включается в адрес или текст ошибки.
 */
export async function fetchFigmaFile({
    token,
    fetchImplementation = fetch as unknown as FigmaFetch,
    timeoutMs = 30_000,
    attempts = 3,
    waitImplementation = wait,
    nowImplementation = Date.now,
}: FetchFigmaFileOptions): Promise<unknown> {
    invariant(typeof token === 'string' && token.length > 0, 'переменная окружения FIGMA_TOKEN не задана');
    invariant(typeof fetchImplementation === 'function', 'реализация Figma REST должна быть функцией');
    invariant(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2 ** 31 - 1, 'тайм-аут Figma REST должен быть положительным целым числом не больше 2147483647');
    invariant(Number.isInteger(attempts) && attempts > 0, 'число попыток Figma REST должно быть положительным целым числом');
    invariant(typeof waitImplementation === 'function', 'реализация ожидания должна быть функцией');
    invariant(typeof nowImplementation === 'function', 'реализация текущего времени должна быть функцией');

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let attemptResult: AttemptResult;
        try {
            attemptResult = await requestOnce({ token, fetchImplementation, timeoutMs });
        } catch (error) {
            if (error instanceof InvalidJsonError) {
                const safeMessage = redactSecret(error.message, token);
                throw new Error(
                    `Экспорт цветов: Figma REST вернул неправильный JSON для файла ${COLOR_EXPORTER_FILE_KEY}: ${safeMessage}`,
                    { cause: new Error(safeMessage) },
                );
            }
            if (!(error instanceof TransportError)) throw error;

            const safeMessage = redactSecret(error.message, token);
            lastError = new Error(
                `Экспорт цветов: запрос Figma REST для файла ${COLOR_EXPORTER_FILE_KEY} завершился ошибкой: ${safeMessage}`,
                { cause: new Error(safeMessage) },
            );
            if (attempt < attempts) {
                await waitImplementation(Math.min(INITIAL_RETRY_DELAY_MS * (2 ** (attempt - 1)), MAX_RETRY_DELAY_MS));
                continue;
            }
            throw lastError;
        }

        const { response, data } = attemptResult;
        if (!response.ok) {
            lastError = new Error(`Экспорт цветов: Figma REST вернул HTTP ${response.status} для файла ${COLOR_EXPORTER_FILE_KEY}`);
            if (attempt < attempts && RETRYABLE_STATUSES.has(response.status)) {
                const delay = retryDelay(response, attempt, nowImplementation);
                // Не сокращаем серверный запрет до нашего предела ожидания.
                // Долгое ограничение требует следующего запуска, а не ранних повторов.
                invariant(delay <= MAX_RETRY_DELAY_MS, `Figma REST вернул HTTP ${response.status} и требует ожидание больше 30 секунд; запустите синхронизацию позже`);
                await waitImplementation(delay);
                continue;
            }
            throw lastError;
        }

        return data;
    }

    throw lastError ?? new Error(`Экспорт цветов: не удалось получить файл ${COLOR_EXPORTER_FILE_KEY}`);
}
