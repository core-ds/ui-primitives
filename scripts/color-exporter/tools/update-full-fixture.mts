import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { invariant, isPlainObject } from '../src/core/assertions.mjs';
import { discoverPalettes } from '../src/core/discover-palettes.mjs';
import { fetchFigmaFile } from '../src/core/fetch-figma.mjs';
import { serializeJson } from '../src/core/json-files.mjs';
import { runPalettes } from '../src/core/run-palettes.mjs';
import type { JsonObject, PaletteDefinition } from '../src/core/types.mjs';
import { buildNormalizedFigmaFixture, sanitizeFigmaFixture } from './fixture-layout.mjs';

type FixtureSource = 'live' | 'snapshot' | 'normalized-json';

interface Options {
    repoRoot?: string;
    outputRoot?: string;
    source: FixtureSource;
    figmaJsonPath?: string;
}

function parseArguments(argumentsList: readonly string[]): Options {
    const options: Options = { source: 'live' };
    const seen = new Set<string>();
    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        invariant(argument !== undefined, 'внутренняя ошибка параметров генератора слепка');
        invariant(
            ['--repo-root', '--output-root', '--source', '--figma-json'].includes(argument),
            `неизвестный параметр ${argument}`,
        );
        invariant(!seen.has(argument), `параметр ${argument} указан несколько раз`);
        const value = argumentsList[index + 1];
        invariant(value !== undefined && !value.startsWith('--'), `после ${argument} требуется значение`);
        seen.add(argument);
        index += 1;
        if (argument === '--repo-root') options.repoRoot = value;
        else if (argument === '--output-root') options.outputRoot = value;
        else if (argument === '--figma-json') options.figmaJsonPath = value;
        else {
            invariant(
                value === 'live' || value === 'snapshot' || value === 'normalized-json',
                `неизвестный источник слепка ${value}`,
            );
            options.source = value;
        }
    }
    return options;
}

function safeOutputRoot(outputRoot: string): string {
    const resolved = path.resolve(outputRoot);
    const fixturesRoot = path.dirname(resolved);
    invariant(
        path.basename(resolved) === 'full'
            && path.basename(fixturesRoot) === 'fixtures'
            && path.basename(path.dirname(fixturesRoot)) === 'tests',
        'папка полного слепка должна оканчиваться на tests/fixtures/full',
    );
    return resolved;
}

async function statIfExists(filePath: string) {
    try {
        return await lstat(filePath);
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

async function assertOrdinaryPath(filePath: string, directory: boolean): Promise<void> {
    const stats = await lstat(filePath);
    invariant(
        directory ? stats.isDirectory() : stats.isFile(),
        `${filePath} должен быть ${directory ? 'папкой' : 'обычным файлом'}, не символической ссылкой`,
    );
}

async function assertDirectoryContents(directory: string, expected: string[]): Promise<void> {
    await assertOrdinaryPath(directory, true);
    const actual = (await readdir(directory)).sort();
    invariant(
        JSON.stringify(actual) === JSON.stringify([...expected].sort()),
        `${directory} не соответствует структуре полного слепка`,
    );
}

/** Не разрешает заменять посторонний каталог или идти через ссылки tests/fixtures. */
async function validateExistingOutput(outputRoot: string): Promise<boolean> {
    const fixturesRoot = path.dirname(outputRoot);
    for (const directory of [path.dirname(fixturesRoot), fixturesRoot]) {
        if (await statIfExists(directory)) await assertOrdinaryPath(directory, true);
    }
    if (await statIfExists(outputRoot) === undefined) return false;
    await assertDirectoryContents(outputRoot, ['figma-sanitized.json', 'manifest.json', 'repository']);
    for (const fileName of ['figma-sanitized.json', 'manifest.json']) {
        await assertOrdinaryPath(path.join(outputRoot, fileName), false);
    }
    const manifest = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')) as unknown;
    invariant(
        isPlainObject(manifest)
            && manifest.schemaVersion === 1
            && ['live', 'snapshot', 'normalized-json'].includes(String(manifest.source))
            && Array.isArray(manifest.palettes)
            && manifest.palettes.length > 0,
        `${outputRoot} не соответствует структуре полного слепка: неправильный манифест`,
    );
    const expectedFiles = manifest.palettes.map((palette) => {
        invariant(
            isPlainObject(palette)
                && typeof palette.id === 'string'
                && /^[a-z0-9-]+$/.test(palette.id)
                && typeof palette.targetJson === 'string'
                && /^styles\/colors_[a-z0-9_]+\.json$/.test(palette.targetJson),
            `${outputRoot} не соответствует структуре полного слепка: неправильная палитра`,
        );
        return path.basename(palette.targetJson);
    });
    const repository = path.join(outputRoot, 'repository');
    const styles = path.join(repository, 'styles');
    await assertDirectoryContents(repository, ['styles']);
    await assertDirectoryContents(styles, expectedFiles);
    for (const fileName of expectedFiles) await assertOrdinaryPath(path.join(styles, fileName), false);
    const figma = JSON.parse(await readFile(path.join(outputRoot, 'figma-sanitized.json'), 'utf8')) as unknown;
    invariant(
        isPlainObject(figma) && isPlainObject(figma.document) && Array.isArray(figma.document.children),
        `${outputRoot} не соответствует структуре полного слепка: неправильный документ`,
    );
    const pageNames = figma.document.children.map((page) => isPlainObject(page) && page.type === 'CANVAS' ? page.name : undefined);
    invariant(
        JSON.stringify(pageNames.sort()) === JSON.stringify(expectedFiles.sort()),
        `${outputRoot} не соответствует структуре полного слепка: страницы не совпадают с манифестом`,
    );
    return true;
}

async function readPaletteJsons(
    repoRoot: string,
    palettes: readonly PaletteDefinition[],
): Promise<{ jsons: Map<string, unknown>; texts: Map<string, string> }> {
    const entries = await Promise.all(palettes.map(async (palette) => {
        const text = await readFile(path.join(repoRoot, palette.targetJson), 'utf8');
        return [palette.targetJson, { text, json: JSON.parse(text) as unknown }] as const;
    }));
    return {
        jsons: new Map(entries.map(([targetJson, value]) => [targetJson, value.json])),
        texts: new Map(entries.map(([targetJson, value]) => [targetJson, value.text])),
    };
}

async function readLiveFixture(palettes: readonly PaletteDefinition[]): Promise<JsonObject> {
    const figmaFile = await fetchFigmaFile({ token: process.env.FIGMA_TOKEN });
    return sanitizeFigmaFixture(figmaFile, palettes);
}

async function readFixtureSource(
    options: Options,
    palettes: readonly PaletteDefinition[],
    paletteJsons: ReadonlyMap<string, unknown>,
): Promise<JsonObject> {
    if (options.source === 'normalized-json') {
        return buildNormalizedFigmaFixture(palettes, paletteJsons);
    }
    if (options.source === 'snapshot') {
        invariant(options.figmaJsonPath !== undefined, 'для source=snapshot нужен --figma-json');
        const snapshot = JSON.parse(await readFile(options.figmaJsonPath, 'utf8')) as unknown;
        return sanitizeFigmaFixture(snapshot, palettes);
    }
    invariant(options.figmaJsonPath === undefined, '--figma-json допустим только для source=snapshot');
    return readLiveFixture(palettes);
}

function countExpectedTokens(paletteJson: unknown): { active: number; deprecated: number } {
    invariant(isPlainObject(paletteJson), 'ожидался объект палитры');
    let active = 0;
    let deprecated = 0;
    for (const token of Object.values(paletteJson)) {
        invariant(isPlainObject(token), 'токен ожидаемой палитры должен быть объектом');
        if (token.deprecated === true) deprecated += 1;
        else active += 1;
    }
    return { active, deprecated };
}

interface UpdateDependencies {
    discover?: typeof discoverPalettes;
    run?: typeof runPalettes;
    rename?: typeof rename;
}

/** Сначала проверяет отдельный новый слепок, затем заменяет прежний каталог. */
export async function main(
    argumentsList = process.argv.slice(2),
    { discover = discoverPalettes, run = runPalettes, rename: renameDirectory = rename }: UpdateDependencies = {},
): Promise<void> {
    const options = parseArguments(argumentsList);
    invariant(options.repoRoot !== undefined, '--repo-root обязателен');
    const repoRoot = path.resolve(options.repoRoot);
    const sourceRoot = path.resolve(
        process.cwd(),
        process.env.COLOR_EXPORTER_SOURCE_ROOT ?? '.',
    );
    const outputRoot = safeOutputRoot(
        options.outputRoot ?? path.join(sourceRoot, 'tests', 'fixtures', 'full'),
    );
    await validateExistingOutput(outputRoot);
    const palettes = await discover();
    invariant(palettes.length > 0, 'для полного слепка нужна хотя бы одна палитра');
    const { jsons, texts } = await readPaletteJsons(repoRoot, palettes);
    const figmaFixture = await readFixtureSource(options, palettes, jsons);

    await mkdir(path.dirname(outputRoot), { recursive: true });
    const temporaryRoot = await mkdtemp(path.join(path.dirname(outputRoot), '.full-update-'));
    const nextRoot = path.join(temporaryRoot, 'next');
    const previousRoot = path.join(temporaryRoot, 'previous');
    let preservePrevious = false;
    try {
        await mkdir(path.join(nextRoot, 'repository', 'styles'), { recursive: true });
        await writeFile(
            path.join(nextRoot, 'figma-sanitized.json'),
            serializeJson(figmaFixture),
            'utf8',
        );
        for (const palette of palettes) {
            const text = texts.get(palette.targetJson);
            invariant(text !== undefined, `не найден ожидаемый ${palette.targetJson}`);
            await writeFile(path.join(nextRoot, 'repository', palette.targetJson), text, 'utf8');
        }

        const manifestPalettes = palettes.map((palette) => {
            const counts = countExpectedTokens(jsons.get(palette.targetJson));
            return { id: palette.id, targetJson: palette.targetJson, ...counts };
        });
        const totals = manifestPalettes.reduce((sum, palette) => ({
            active: sum.active + palette.active,
            deprecated: sum.deprecated + palette.deprecated,
        }), { active: 0, deprecated: 0 });
        await writeFile(path.join(nextRoot, 'manifest.json'), serializeJson({
            schemaVersion: 1,
            source: options.source,
            palettes: manifestPalettes,
            totals,
        }), 'utf8');

        const results = await run({
            palettes,
            repoRoot: path.join(nextRoot, 'repository'),
            figmaJsonPath: path.join(nextRoot, 'figma-sanitized.json'),
            check: true,
        });
        invariant(
            results.length === palettes.length
                && palettes.every((palette) => results.some((result) => (
                    result.paletteId === palette.id && result.targetJson === palette.targetJson
                ))),
            'проверка слепка не охватила все выбранные палитры',
        );
        invariant(results.every((result) => !result.changed), 'новый слепок не воспроизводит ожидаемые JSON');
        const hadPrevious = await validateExistingOutput(outputRoot);
        if (hadPrevious) await renameDirectory(outputRoot, previousRoot);
        try {
            await renameDirectory(nextRoot, outputRoot);
        } catch (installError) {
            if (hadPrevious) {
                try {
                    await renameDirectory(previousRoot, outputRoot);
                } catch (restoreError) {
                    preservePrevious = true;
                    throw new AggregateError(
                        [installError, restoreError],
                        `не удалось установить слепок и восстановить прежний; копия сохранена в ${previousRoot}`,
                    );
                }
            }
            throw installError;
        }
        process.stdout.write(
            `Полный слепок готов: ${palettes.length} палитр, ${totals.active} активных и ${totals.deprecated} устаревших токенов.\n`,
        );
    } finally {
        if (!preservePrevious) await rm(temporaryRoot, { recursive: true, force: true });
    }
}

const launchedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (launchedFile === import.meta.url) {
    main().catch((error: unknown) => {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    });
}
