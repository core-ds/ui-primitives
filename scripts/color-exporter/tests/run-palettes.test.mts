import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runPalettes } from '../src/core/run-palettes.mjs';
import bluetint from '../src/palettes/bluetint.mjs';
import { createStandardPaletteForPage } from '../src/palettes/_create-standard.mjs';
import { sourceFile } from './test-paths.mjs';

const figmaFixturePath = sourceFile('tests', 'fixtures', 'bluetint-figma.json');
const codeFixturePath = sourceFile('tests', 'fixtures', 'bluetint-code-before.json');

test('полный запуск записывает JSON один раз и затем становится идемпотентным', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const targetPath = path.join(stylesDirectory, 'colors_bluetint.json');
    const oldText = await readFile(codeFixturePath, 'utf8');
    try {
        await mkdir(stylesDirectory, { recursive: true });
        await writeFile(targetPath, oldText, 'utf8');

        const first = await runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
        });
        const writtenText = await readFile(targetPath, 'utf8');
        const second = await runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
            check: true,
        });

        const firstResult = first[0];
        const secondResult = second[0];
        assert.ok(firstResult);
        assert.ok(secondResult);
        assert.equal(firstResult.changed, true);
        assert.notEqual(writtenText, oldText);
        assert.equal(writtenText.endsWith('\n'), true);
        assert.equal(secondResult.changed, false);
        assert.deepEqual(secondResult.changes, {
            newTokenKeys: [],
            restoredTokenKeys: [],
            changedActiveTokenKeys: [],
            newlyDeprecatedTokenKeys: [],
        });
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('все страницы единственного Color Exporter делят один REST-запрос', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const firstPath = path.join(stylesDirectory, 'colors_bluetint.json');
    const secondPath = path.join(stylesDirectory, 'colors_second.json');
    const oldText = await readFile(codeFixturePath, 'utf8');
    const figmaFile = JSON.parse(await readFile(figmaFixturePath, 'utf8'));
    const secondPage = structuredClone(figmaFile.document.children[0]);
    secondPage.name = 'colors_second.json';
    figmaFile.document.children.push(secondPage);
    let requests = 0;

    try {
        await mkdir(stylesDirectory, { recursive: true });
        await Promise.all([
            writeFile(firstPath, oldText, 'utf8'),
            writeFile(secondPath, oldText, 'utf8'),
        ]);
        const secondPalette = {
            ...bluetint,
            id: 'second',
            targetJson: 'styles/colors_second.json',
            figma: {
                ...bluetint.figma,
                pageName: 'colors_second.json',
            },
        };

        const results = await runPalettes({
            palettes: [bluetint, secondPalette],
            repoRoot: temporaryRoot,
            figmaToken: 'секрет',
            check: true,
            fetchImplementation: async () => {
                requests += 1;
                return {
                    ok: true,
                    status: 200,
                    async json() { return figmaFile; },
                };
            },
        });

        assert.equal(requests, 1);
        assert.deepEqual(results.map((result) => result.paletteId), ['bluetint', 'second']);
        assert.equal(results.every((result) => result.changed), true);
        assert.equal(await readFile(firstPath, 'utf8'), oldText);
        assert.equal(await readFile(secondPath, 'utf8'), oldText);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('новая стандартная страница сама создаёт одноимённый JSON', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const bluetintPath = path.join(stylesDirectory, 'colors_bluetint.json');
    const newTargetPath = path.join(stylesDirectory, 'colors_new_palette.json');
    const snapshotPath = path.join(temporaryRoot, 'figma.json');
    const oldText = await readFile(codeFixturePath, 'utf8');
    const figmaFile = JSON.parse(await readFile(figmaFixturePath, 'utf8'));
    const newPage = structuredClone(figmaFile.document.children[0]);
    newPage.name = 'colors_new_palette.json';
    figmaFile.document.children.push(newPage);
    const createdPages: string[] = [];

    try {
        await mkdir(stylesDirectory, { recursive: true });
        await writeFile(bluetintPath, oldText, 'utf8');
        await writeFile(snapshotPath, `${JSON.stringify(figmaFile)}\n`, 'utf8');

        const results = await runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: snapshotPath,
            createPaletteForPage(page) {
                createdPages.push(page.pageName);
                return createStandardPaletteForPage(page);
            },
            loadBaselineJsonText: async (targetJson) => (
                targetJson === bluetint.targetJson ? oldText : undefined
            ),
        });

        assert.deepEqual(createdPages, ['colors_new_palette.json']);
        assert.deepEqual(results.map((result) => result.targetJson), [
            'styles/colors_bluetint.json',
            'styles/colors_new_palette.json',
        ]);
        const newResult = results[1];
        assert.ok(newResult);
        assert.equal(newResult.paletteId, 'new-palette');
        assert.equal(newResult.changed, true);
        assert.equal(newResult.summary.newTokens, newResult.summary.tokens);
        assert.equal((await stat(newTargetPath)).mode & 0o777, 0o644);
        assert.equal((await readFile(newTargetPath, 'utf8')).endsWith('\n'), true);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('отсутствующая страница не читает и не изменяет свой JSON', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const snapshotPath = path.join(temporaryRoot, 'figma.json');
    let baselineReads = 0;
    try {
        await writeFile(snapshotPath, '{"document":{"children":[]}}\n', 'utf8');
        const results = await runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: snapshotPath,
            createPaletteForPage: createStandardPaletteForPage,
            loadBaselineJsonText: async () => {
                baselineReads += 1;
                return '{}\n';
            },
        });

        assert.deepEqual(results, []);
        assert.equal(baselineReads, 0);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('активная страница читается, а отсутствующая с повреждённым JSON остаётся нетронутой', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-active-'));
    const absent = createStandardPaletteForPage({ pageName: 'colors_absent.json' });
    const baselineReads: string[] = [];
    try {
        const stylesDirectory = path.join(temporaryRoot, 'styles');
        const absentPath = path.join(temporaryRoot, absent.targetJson);
        const brokenText = '{ неправильный JSON отсутствующей страницы';
        await mkdir(stylesDirectory);
        await writeFile(absentPath, brokenText);

        const results = await runPalettes({
            palettes: [absent, bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
            loadBaselineJsonText: async (targetJson) => {
                baselineReads.push(targetJson);
                assert.equal(targetJson, bluetint.targetJson);
                return '{}\n';
            },
        });

        assert.deepEqual(baselineReads, [bluetint.targetJson]);
        assert.deepEqual(results.map(({ paletteId }) => paletteId), ['bluetint']);
        assert.equal(await readFile(absentPath, 'utf8'), brokenText);
        assert.equal(Object.keys(JSON.parse(await readFile(
            path.join(temporaryRoot, bluetint.targetJson), 'utf8',
        ))).length, 4);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('повтор экспортной страницы останавливает запуск до чтения исходных JSON', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-duplicate-page-'));
    let baselineReads = 0;
    try {
        const figmaFile = JSON.parse(await readFile(figmaFixturePath, 'utf8'));
        figmaFile.document.children.push(structuredClone(figmaFile.document.children[0]));

        await assert.rejects(runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaToken: 'тест',
            fetchImplementation: async () => ({ ok: true, status: 200, json: async () => figmaFile }),
            loadBaselineJsonText: async () => {
                baselineReads += 1;
                return '{}\n';
            },
        }), /повторяющиеся экспортные страницы/);

        assert.equal(baselineReads, 0);
        assert.deepEqual(await readdir(temporaryRoot), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('без особых модулей стандартная страница создаёт JSON', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-standard-'));
    try {
        await mkdir(path.join(temporaryRoot, 'styles'));
        const results = await runPalettes({
            palettes: [],
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
            createPaletteForPage: createStandardPaletteForPage,
        });
        assert.deepEqual(results.map(({ paletteId }) => paletteId), ['bluetint']);
        const tokens = JSON.parse(await readFile(path.join(temporaryRoot, bluetint.targetJson), 'utf8'));
        assert.equal(Object.keys(tokens).length, 4);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('без особых модулей и экспортных страниц запуск ничего не создаёт', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-empty-'));
    try {
        const results = await runPalettes({
            palettes: [],
            repoRoot: temporaryRoot,
            figmaToken: 'тест',
            createPaletteForPage: createStandardPaletteForPage,
            fetchImplementation: async () => ({
                ok: true,
                status: 200,
                json: async () => ({ document: { children: [] } }),
            }),
            loadBaselineJsonText: async () => assert.fail('без страниц исходные JSON не читаются'),
        });
        assert.deepEqual(results, []);
        assert.deepEqual(await readdir(temporaryRoot), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('пустой по содержанию снимок остаётся источником и не подменяется REST-запросом', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const targetPath = path.join(stylesDirectory, 'colors_bluetint.json');
    const snapshotPath = path.join(temporaryRoot, 'figma.json');
    try {
        await mkdir(stylesDirectory, { recursive: true });
        await writeFile(targetPath, '{}\n', 'utf8');
        await writeFile(snapshotPath, 'null\n', 'utf8');

        await assert.rejects(runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: snapshotPath,
            fetchImplementation: async () => assert.fail('REST-запрос не должен вызываться'),
        }), /ответ Figma/);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('повреждённые снимки и исходные JSON завершают запуск понятной ошибкой', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-run-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const targetPath = path.join(stylesDirectory, 'colors_bluetint.json');
    const invalidSnapshotPath = path.join(temporaryRoot, 'invalid-figma.json');
    const missingSnapshotPath = path.join(temporaryRoot, 'missing-figma.json');
    const oldText = await readFile(codeFixturePath, 'utf8');

    try {
        await mkdir(stylesDirectory, { recursive: true });
        await writeFile(targetPath, oldText, 'utf8');

        await assert.rejects(runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: missingSnapshotPath,
        }), /не удалось прочитать снимок Figma/);

        await writeFile(invalidSnapshotPath, '{ неправильный json', 'utf8');
        await assert.rejects(runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: invalidSnapshotPath,
        }), /снимок Figma .* содержит неправильный JSON/);

        await assert.rejects(runPalettes({
            palettes: [bluetint],
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
            baselineJsonTexts: new Map([[bluetint.targetJson, '{ неправильный json']]),
            check: true,
        }), /исходная версия .* содержит неправильный JSON/);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('параметры запуска и карта исходных JSON проверяются до чтения файлов', async () => {
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '',
        figmaJsonPath: figmaFixturePath,
    }), /repoRoot должен быть непустой строкой/);
    await assert.rejects(runPalettes({
        palettes: [bluetint, bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: figmaFixturePath,
    }), /палитра bluetint выбрана несколько раз/);
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: '',
    }), /figmaJsonPath должен быть непустым путём/);
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: figmaFixturePath,
        check: 'да' as unknown as boolean,
    }), /check должен быть логическим значением/);
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: figmaFixturePath,
        baselineJsonTexts: {} as ReadonlyMap<string, string>,
    }), /исходные JSON основной ветки должны быть Map/);
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: figmaFixturePath,
        baselineJsonTexts: new Map(),
    }), /нет исходной версии styles\/colors_bluetint\.json/);
    await assert.rejects(runPalettes({
        palettes: [bluetint],
        repoRoot: '/tmp/example',
        figmaJsonPath: figmaFixturePath,
        baselineJsonTexts: new Map([['styles/colors_other.json', '{}\n']]),
    }), /нет исходной версии styles\/colors_bluetint\.json/);
});
