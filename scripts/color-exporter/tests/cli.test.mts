import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { main, parseCliArguments } from '../src/cli.mjs';
import bluetint from '../src/palettes/bluetint.mjs';
import { createStandardPaletteForPage } from '../src/palettes/_create-standard.mjs';
import type { PaletteRunResult, RunPalettesOptions } from '../src/core/types.mjs';
import { sourceFile } from './test-paths.mjs';

test('командная строка разбирает набор, путь, снимок и режим проверки', () => {
    assert.deepEqual(
        parseCliArguments([
            '--repo-root', '/tmp/repo',
            '--palette', 'bluetint',
            '--figma-json', '/tmp/figma.json',
            '--check',
        ]),
        {
            repoRoot: '/tmp/repo',
            palette: 'bluetint',
            figmaJsonPath: '/tmp/figma.json',
            check: true,
            help: false,
        },
    );
});

test('командная строка отклоняет неизвестные, повторные и пустые параметры', () => {
    assert.throws(() => parseCliArguments(['--unknown']), /неизвестный параметр/);
    assert.throws(() => parseCliArguments(['--check', '--check']), /указан несколько раз/);
    assert.throws(() => parseCliArguments(['--repo-root']), /требуется значение/);
    assert.throws(() => parseCliArguments(['--repo-root', '--check']), /требуется значение/);
});

test('режим справки не запускает обнаружение палитр', async () => {
    let discoveryCalled = false;
    let text = '';
    const result = await main(['--help'], {
        output: { write(value) { text += value; } },
        discover: async () => {
            discoveryCalled = true;
            return [];
        },
    });

    assert.equal(discoveryCalled, false);
    assert.match(text, /Локальный запуск/);
    assert.deepEqual(result, { results: [], exitCode: 0 });
});

test('один снимок Figma можно проверить сразу для всех палитр', async () => {
    const palettes = [bluetint];
    let received: RunPalettesOptions | undefined;
    let output = '';
    const expectedResults: PaletteRunResult[] = [{
        paletteId: 'bluetint',
        targetJson: 'styles/colors_bluetint.json',
        changed: true,
        changes: {
            newTokenKeys: [],
            restoredTokenKeys: [],
            changedActiveTokenKeys: [],
            newlyDeprecatedTokenKeys: [],
        },
        summary: {
            sections: 0,
            frames: 0,
            rectangles: 0,
            placeholders: 0,
            tokens: 0,
            oldTokens: 0,
            resultTokens: 0,
            activeTokens: 0,
            deprecatedTokens: 0,
            newTokens: 0,
            restoredTokens: 0,
            changedActiveTokens: 0,
            newlyDeprecatedTokens: 0,
        },
    }];
    const result = await main([
        '--repo-root', '/tmp/repo',
        '--figma-json', '/tmp/figma.json',
        '--check',
    ], {
        environment: {},
        output: { write(value) { output += value; } },
        discover: async () => palettes,
        run: async (options) => {
            received = options;
            return expectedResults;
        },
    });

    assert.deepEqual(received, {
        palettes,
        selectedPaletteId: undefined,
        repoRoot: '/tmp/repo',
        figmaToken: undefined,
        check: true,
        figmaJsonPath: '/tmp/figma.json',
        createPaletteForPage: createStandardPaletteForPage,
    });
    assert.equal(JSON.parse(output)[0].changed, true);
    assert.deepEqual(result, { results: expectedResults, exitCode: 2 });
});

test('исполняемый файл выводит справку и сообщает об ошибке параметров', () => {
    const cliPath = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
    const help = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Локальный запуск экспорта цветов/);
    assert.equal(help.stderr, '');

    const failure = spawnSync(process.execPath, [cliPath, '--unknown'], { encoding: 'utf8' });
    assert.equal(failure.status, 1);
    assert.equal(failure.stdout, '');
    assert.match(failure.stderr, /неизвестный параметр --unknown/);
});

test('командная строка выбирает новый стандартный набор после чтения страниц Figma', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-cli-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const snapshotPath = path.join(temporaryRoot, 'figma.json');
    try {
        await mkdir(stylesDirectory);
        const figmaFile = JSON.parse(await readFile(sourceFile('tests', 'fixtures', 'bluetint-figma.json'), 'utf8'));
        const newPage = structuredClone(figmaFile.document.children[0]);
        newPage.name = 'colors_new_palette.json';
        // Не выбранная страница не разбирается и не мешает точечному запуску.
        figmaFile.document.children[0].children = [];
        figmaFile.document.children.push(newPage);
        await writeFile(snapshotPath, JSON.stringify(figmaFile), 'utf8');
        const { results, exitCode } = await main([
            '--repo-root', temporaryRoot,
            '--figma-json', snapshotPath,
            '--palette', 'new-palette',
        ], {
            environment: {},
            output: { write() {} },
            discover: async () => [],
        });
        assert.equal(exitCode, 0);
        assert.deepEqual(results.map(({ paletteId }) => paletteId), ['new-palette']);
        assert.deepEqual(await readdir(stylesDirectory), ['colors_new_palette.json']);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('командная строка без модулей и страниц возвращает пустой результат', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-cli-'));
    const snapshotPath = path.join(temporaryRoot, 'figma.json');
    try {
        await writeFile(snapshotPath, '{"document":{"children":[]}}', 'utf8');
        let output = '';
        assert.deepEqual(await main([
            '--repo-root', temporaryRoot,
            '--figma-json', snapshotPath,
        ], {
            environment: {},
            output: { write(value) { output += value; } },
            discover: async () => [],
        }), { results: [], exitCode: 0 });
        assert.equal(output, '[]\n');
        assert.deepEqual(await readdir(temporaryRoot), ['figma.json']);
        await assert.rejects(main([
            '--repo-root', temporaryRoot,
            '--figma-json', snapshotPath,
            '--palette', 'missing',
        ], {
            environment: {},
            output: { write() {} },
            discover: async () => [],
        }), /палитра missing не найдена/);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});
