import { setTimeout as wait } from 'node:timers/promises';
import { FILE_KEY, requireValue } from './contract.mjs';

/** Три попытки к одному адресу; секрет не попадает ни в URL, ни в ошибки. */
export async function fetchFigma(token: string, request = fetch, pause: (delay: number) => Promise<void> = wait): Promise<unknown> {
    requireValue(typeof token === 'string' && token.length, 'FIGMA_TOKEN не задан');
    for (let attempt = 0; ; attempt++) {
        let delay = 500 * 2 ** attempt;
        let retry = true;
        try {
            const response = await request(`https://api.figma.com/v1/files/${FILE_KEY}`, {
                headers: { 'X-FIGMA-TOKEN': token }, redirect: 'error', signal: AbortSignal.timeout(30_000),
            });
            if (response.ok) {
                try { return await response.json(); } catch (error) {
                    if (error instanceof SyntaxError) retry = false;
                    throw error;
                }
            }
            await response.body?.cancel();
            retry = [429, 500, 502, 503, 504].includes(response.status);
            const after = response.headers.get('retry-after');
            if (after) delay = /^\d+$/.test(after) ? Number(after) * 1000 : Math.max(0, Date.parse(after) - Date.now());
            if (!Number.isFinite(delay)) delay = 500 * 2 ** attempt;
            // Не повторяем запрос раньше разрешённого сервером срока.
            if (delay > 30_000) retry = false;
            throw new Error(`Figma REST: HTTP ${response.status}`);
        } catch (error) {
            if (!retry || attempt === 2) throw new Error(String((error as Error).message).replaceAll(token, '[секрет скрыт]'));
        }
        await pause(delay);
    }
}
