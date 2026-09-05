import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchFigmaFile } from '../src/core/fetch-figma.mjs';
import { COLOR_EXPORTER_FILE_KEY, COLOR_EXPORTER_REST_URL } from '../src/core/figma-source.mjs';
import type { FigmaResponseLike } from '../src/core/types.mjs';

interface ResponseOptions {
    status?: number;
    json?: () => Promise<unknown>;
    retryAfter?: string;
}

function response({
    status = 200,
    json = async () => ({ ok: true }),
    retryAfter,
}: ResponseOptions = {}): FigmaResponseLike {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get(name: string) {
                return name.toLowerCase() === 'retry-after' ? (retryAfter ?? null) : null;
            },
        },
        json,
    };
}

test('Figma REST получает токен только в заголовке', async () => {
    assert.equal(COLOR_EXPORTER_FILE_KEY, 'JGR9GpDXUneyYHfDdb7BDT');
    assert.equal(
        COLOR_EXPORTER_REST_URL,
        'https://api.figma.com/v1/files/JGR9GpDXUneyYHfDdb7BDT',
    );
    const calls: Array<[string, RequestInit]> = [];
    const result = await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async (input, init) => {
            calls.push([input, init]);
            return response({ json: async () => ({ document: {} }) });
        },
    });

    assert.deepEqual(result, { document: {} });
    const firstCall = calls[0];
    assert.ok(firstCall);
    assert.equal(firstCall[0], COLOR_EXPORTER_REST_URL);
    assert.deepEqual(firstCall[1].headers, { 'X-FIGMA-TOKEN': 'секрет' });
    assert.equal(firstCall[0].includes('секрет'), false);
    assert.equal(firstCall[1].signal instanceof AbortSignal, true);
    assert.equal(firstCall[1].redirect, 'error');
});

test('временная сетевая ошибка и HTTP 503 повторяются с ограниченной задержкой', async () => {
    const outcomes: Array<Error | FigmaResponseLike> = [
        new Error('сеть временно недоступна'),
        response({ status: 503 }),
        response({ json: async () => ({ name: 'готово' }) }),
    ];
    const waits: number[] = [];
    let calls = 0;

    const result = await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async () => {
            const outcome = outcomes[calls];
            calls += 1;
            assert.ok(outcome);
            if (outcome instanceof Error) throw outcome;
            return outcome;
        },
        waitImplementation: async (milliseconds) => {
            waits.push(milliseconds);
        },
    });

    assert.deepEqual(result, { name: 'готово' });
    assert.equal(calls, 3);
    assert.deepEqual(waits, [500, 1000]);
});

test('короткий Retry-After соблюдается без изменения интервала', async () => {
    const waits: number[] = [];
    let calls = 0;
    await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async () => {
            calls += 1;
            return calls === 1
                ? response({ status: 429, retryAfter: '15' })
                : response();
        },
        waitImplementation: async (milliseconds) => {
            waits.push(milliseconds);
        },
    });

    assert.deepEqual(waits, [15_000]);
});

test('длинный Retry-After останавливает запуск, не отправляя преждевременный повтор', async () => {
    let calls = 0;
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async () => {
            calls += 1;
            return calls === 1 ? response({ status: 429, retryAfter: '120' }) : response();
        },
        waitImplementation: async () => assert.fail('при долгом ограничении ожидание не начинается'),
    }), /HTTP 429.*больше 30 секунд.*позже/);
    assert.equal(calls, 1);
});

test('ошибочный HTTP-ответ отменяется до следующей попытки', async () => {
    let previousSignal: AbortSignal | undefined;
    await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async (_url, init) => {
            if (previousSignal !== undefined) {
                assert.equal(previousSignal.aborted, true);
                return response();
            }
            assert.ok(init.signal);
            previousSignal = init.signal;
            return response({ status: 503 });
        },
        waitImplementation: async () => {},
    });
});

test('Retry-After поддерживает дату и безопасный запасной интервал', async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const dateWaits: number[] = [];
    let dateCalls = 0;
    await fetchFigmaFile({
        token: 'секрет',
        nowImplementation: () => now,
        fetchImplementation: async () => {
            dateCalls += 1;
            return dateCalls === 1
                ? response({ status: 429, retryAfter: new Date(now + 5_000).toUTCString() })
                : response();
        },
        waitImplementation: async (milliseconds) => { dateWaits.push(milliseconds); },
    });
    assert.deepEqual(dateWaits, [5_000]);

    for (const brokenHeader of ['не дата', 'throws']) {
        const waits: number[] = [];
        let calls = 0;
        await fetchFigmaFile({
            token: 'секрет',
            fetchImplementation: async () => {
                calls += 1;
                if (calls > 1) return response();
                if (brokenHeader === 'не дата') {
                    return response({ status: 503, retryAfter: brokenHeader });
                }
                return {
                    ...response({ status: 503 }),
                    headers: { get() { throw new Error('заголовки повреждены'); } },
                };
            },
            waitImplementation: async (milliseconds) => { waits.push(milliseconds); },
        });
        assert.deepEqual(waits, [500]);
    }
});

test('стандартное ожидание используется без тестовой подмены', async () => {
    let calls = 0;
    const result = await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async () => {
            calls += 1;
            if (calls === 1) throw new Error('временный сбой');
            return response({ json: async () => ({ готово: true }) });
        },
    });

    assert.deepEqual(result, { готово: true });
    assert.equal(calls, 2);
});

test('постоянная HTTP-ошибка не повторяется', async () => {
    let calls = 0;

    await assert.rejects(
        fetchFigmaFile({
            token: 'секрет',
            fetchImplementation: async () => {
                calls += 1;
                return response({ status: 403 });
            },
            waitImplementation: async () => assert.fail('ожидание не должно вызываться'),
        }),
        new RegExp(`HTTP 403.*${COLOR_EXPORTER_FILE_KEY}`),
    );
    assert.equal(calls, 1);
});

test('синтаксическая ошибка JSON не повторяется и не раскрывает токен', async () => {
    const secret = 'очень-секретно';
    let calls = 0;
    await assert.rejects(
        fetchFigmaFile({
            token: secret,
            fetchImplementation: async () => {
                calls += 1;
                return response({
                    json: async () => { throw new SyntaxError(`неверный JSON ${secret}`); },
                });
            },
        }),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, new RegExp(`неправильный JSON.*${COLOR_EXPORTER_FILE_KEY}`));
            assert.equal(error.message.includes(secret), false);
            return true;
        },
    );
    assert.equal(calls, 1);
});

test('транспортная ошибка чтения тела повторяется', async () => {
    let calls = 0;
    const waits: number[] = [];
    const result = await fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: async () => {
            calls += 1;
            return response({
                json: calls === 1
                    ? async () => { throw new TypeError('соединение оборвалось при чтении тела'); }
                    : async () => ({ document: {} }),
            });
        },
        waitImplementation: async (milliseconds) => {
            waits.push(milliseconds);
        },
    });

    assert.deepEqual(result, { document: {} });
    assert.equal(calls, 2);
    assert.deepEqual(waits, [500]);
});

test('токен удаляется даже из текста ошибки сетевой реализации', async () => {
    const secret = 'figma-секрет-который-нельзя-печатать';
    await assert.rejects(
        fetchFigmaFile({
            token: secret,
            attempts: 1,
            fetchImplementation: async () => {
                throw new Error(`сбой транспорта с заголовком ${secret}`);
            },
        }),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal(error.message.includes(secret), false);
            assert.ok(error.cause instanceof Error);
            assert.equal(error.cause.message.includes(secret), false);
            assert.match(error.message, /\[секрет скрыт\]/);
            return true;
        },
    );
});

test('тайм-аут охватывает зависшее чтение JSON-тела', async () => {
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        timeoutMs: 5,
        attempts: 1,
        fetchImplementation: async () => response({
            json: async () => new Promise<never>(() => undefined),
        }),
    }), /запрос Figma REST.*тайм-аут/);
});

test('зависший REST-запрос отменяется по тайм-ауту', async () => {
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        timeoutMs: 5,
        attempts: 1,
        fetchImplementation: async (_input, init) => new Promise<FigmaResponseLike>((_resolve, reject) => {
            assert.ok(init.signal);
            init.signal.addEventListener('abort', () => reject(new Error('запрос отменён')), { once: true });
        }),
    }), /запрос Figma REST.*(?:запрос отменён|тайм-аут)/);
});

test('поля запроса проверяются до сети', async () => {
    await assert.rejects(fetchFigmaFile({ token: '' }), /FIGMA_TOKEN не задана/);
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        fetchImplementation: null as unknown as typeof fetch,
    }), /реализация Figma REST должна быть функцией/);
    await assert.rejects(fetchFigmaFile({ token: 'секрет', timeoutMs: 0 }), /тайм-аут/);
    await assert.rejects(fetchFigmaFile({ token: 'секрет', attempts: 0 }), /число попыток/);
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        waitImplementation: null as unknown as (milliseconds: number) => Promise<void>,
    }), /реализация ожидания должна быть функцией/);
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        nowImplementation: null as unknown as () => number,
    }), /реализация текущего времени должна быть функцией/);
    await assert.rejects(fetchFigmaFile({
        token: 'секрет',
        attempts: 1,
        fetchImplementation: async () => ({ ok: true } as FigmaResponseLike),
    }), /объект ответа неправильного формата/);
});
