import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { requireValue } from './contract.mjs';
import { readLocal } from './files.mjs';
import { prepare, writePlans, fetchFigma } from './sync.mjs';

/** Локальный запуск не выполняет команд Git и не создаёт запросов на слияние. */
export async function main(args = process.argv.slice(2)): Promise<number> {
    const { values, tokens } = parseArgs({ args, tokens: true, options: {
        'repo-root': { type: 'string' }, 'figma-json': { type: 'string' },
        palette: { type: 'string' }, check: { type: 'boolean' }, help: { type: 'boolean' },
    } });
    const names = tokens.filter((token) => token.kind === 'option').map((token) => token.name);
    requireValue(new Set(names).size === names.length, 'Параметр указан несколько раз');
    if (values.help) {
        console.info('Экспорт цветов: --repo-root <путь> [--figma-json <снимок REST>] [--palette <набор>] [--check]\n--check: без записи; код 2 означает наличие изменений. Без снимка нужен FIGMA_TOKEN.');
        return 0;
    }
    const root = values['repo-root'];
    requireValue(root, '--repo-root обязателен');
    const source = values['figma-json'] ? JSON.parse(await readFile(values['figma-json'], 'utf8')) : await fetchFigma(process.env.FIGMA_TOKEN ?? '');
    const plans = await prepare(source, (path) => readLocal(root, path), values.palette);
    if (!values.check) await writePlans(root, plans, true);
    console.info(JSON.stringify(plans.map(({ path, before, text, deprecated }) => ({ path, changed: before !== text, deprecated })), null, 2));
    return values.check && plans.some((plan) => plan.before !== plan.text) ? 2 : 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
        console.error((error as Error).message);
        process.exitCode = 1;
    });
}
