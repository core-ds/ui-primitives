import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { makePullRequestBody, makePushArguments } from '../src/action/run-github-action.mjs';
import { resolveTargetPath } from '../src/core/json-files.mjs';
import { runPalettes } from '../src/core/run-palettes.mjs';
import bluetint from '../src/palettes/bluetint.mjs';
import { sourceFile, workspaceFile } from './test-paths.mjs';

test('целевой путь не может выйти за пределы репозитория', () => {
    assert.throws(
        () => resolveTargetPath('/tmp/example-repo', '../secret.json'),
        /выходит за пределы repo-root/,
    );
});

test('ошибка второй палитры не разрешает записать первую', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-test-'));
    const stylesDirectory = path.join(temporaryRoot, 'styles');
    const firstTarget = path.join(stylesDirectory, 'colors_bluetint.json');
    const secondTarget = path.join(stylesDirectory, 'colors_broken.json');
    const brokenFigmaPath = path.join(temporaryRoot, 'figma-broken.json');
    const fixtureText = await readFile(sourceFile('tests', 'fixtures', 'bluetint-code-before.json'), 'utf8');
    const figmaPath = sourceFile('tests', 'fixtures', 'bluetint-figma.json');

    try {
        await mkdir(stylesDirectory, { recursive: true });
        await Promise.all([
            writeFile(firstTarget, fixtureText, 'utf8'),
            writeFile(secondTarget, fixtureText, 'utf8'),
        ]);
        const figmaFile = JSON.parse(await readFile(figmaPath, 'utf8'));
        const brokenPage = structuredClone(figmaFile.document.children[0]);
        brokenPage.name = 'colors_broken.json';
        brokenPage.children[0].children[0].children[0].name = 'неизвестное-состояние';
        figmaFile.document.children.push(brokenPage);
        await writeFile(brokenFigmaPath, `${JSON.stringify(figmaFile)}\n`, 'utf8');

        const brokenPalette = {
            ...bluetint,
            id: 'broken',
            targetJson: 'styles/colors_broken.json',
            figma: {
                ...bluetint.figma,
                pageName: 'colors_broken.json',
            },
        };

        await assert.rejects(
            runPalettes({
                palettes: [bluetint, brokenPalette],
                repoRoot: temporaryRoot,
                figmaJsonPath: brokenFigmaPath,
            }),
            /неизвестное состояние/,
        );
        assert.equal(await readFile(firstTarget, 'utf8'), fixtureText);
        assert.equal(await readFile(secondTarget, 'utf8'), fixtureText);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('описание реквеста формируется по-русски и явно запрещает автоматическое слияние', () => {
    const body = makePullRequestBody([{
        paletteId: 'bluetint',
        targetJson: 'styles/colors_bluetint.json',
        changed: false,
        changes: {
            newTokenKeys: [],
            restoredTokenKeys: [],
            changedActiveTokenKeys: [],
            newlyDeprecatedTokenKeys: [],
        },
        summary: {
            sections: 32,
            frames: 300,
            rectangles: 694,
            placeholders: 2,
            tokens: 692,
            oldTokens: 892,
            resultTokens: 892,
            activeTokens: 692,
            deprecatedTokens: 200,
            newTokens: 0,
            restoredTokens: 0,
            changedActiveTokens: 0,
            newlyDeprecatedTokens: 0,
        },
    }]);

    assert.match(body, /Что изменилось/);
    assert.match(body, /692 активных/);
    assert.match(body, /автоматическое слияние реквеста не выполняется/);
});

test('служебная ветка отправляется обычным push без принудительной перезаписи', () => {
    const argumentsList = makePushArguments();

    assert.deepEqual(argumentsList, ['push', 'origin', 'HEAD:feat/update-colors']);
    assert.equal(argumentsList.some((argument) => argument.startsWith('--force')), false);
    assert.throws(() => makePushArguments('../bad'), /недопустимое имя служебной ветки/);
});

test('внешние GitHub Actions закреплены по полным SHA, а ненужный кеш отключён', async () => {
    const workflow = await readFile(workspaceFile('.github', 'workflows', 'export-colors.yml'), 'utf8');
    const actionReferences = Array.from(workflow.matchAll(/^\s*uses:\s+[^@\s]+@([^\s]+)/gm), (match) => match[1] ?? '');

    assert.equal(actionReferences.length, 3);
    assert.equal(actionReferences.every((reference) => /^[0-9a-f]{40}$/.test(reference)), true);
    assert.match(workflow, /fetch-depth: 0/);
    assert.match(workflow, /package-manager-cache: false/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /run: npm ci/);
    assert.match(workflow, /run: npm run build/);
    assert.match(workflow, /COLOR_EXPORTER_SOURCE_ROOT: scripts\/color-exporter/);
    assert.match(workflow, /--test-coverage-include='dist\/color-exporter\/src\/\*\*\/\*\.mjs'/);
    assert.match(workflow, /--test-coverage-lines=100/);
    assert.match(workflow, /--test-coverage-branches=95/);
    assert.match(workflow, /--test-coverage-functions=98/);
    assert.match(workflow, /dist\/color-exporter\/tests\/\*\.test\.mjs/);
    assert.match(workflow, /dist\/color-exporter\/src\/action\/run-github-action\.mjs/);
});
