import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { isPlainObject } from '../src/core/assertions.mjs';
import { discoverPalettes } from '../src/core/discover-palettes.mjs';
import { runPalettes } from '../src/core/run-palettes.mjs';
import { SANITIZED_VARIABLE_ID } from '../tools/fixture-layout.mjs';
import { sourceFile } from './test-paths.mjs';

const fixtureRoot = sourceFile('tests', 'fixtures', 'full');
const fixtureRepository = path.join(fixtureRoot, 'repository');
const figmaFixturePath = path.join(fixtureRoot, 'figma-sanitized.json');

function assertNoPrivateFigmaMetadata(value: unknown): void {
    if (Array.isArray(value)) {
        for (const item of value) assertNoPrivateFigmaMetadata(item);
        return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, nestedValue] of Object.entries(value)) {
        if (key === 'id' && nestedValue === SANITIZED_VARIABLE_ID) continue;
        assert.equal(
            ['id', 'componentId', 'styleId', 'user', 'thumbnailUrl', 'lastModified', 'version'].includes(key),
            false,
            `в обезличенном слепке найдено закрытое поле ${key}`,
        );
        assertNoPrivateFigmaMetadata(nestedValue);
    }
}

test('самодостаточный слепок всех десяти палитр побайтно воспроизводит ожидаемые JSON', async () => {
    const palettes = await discoverPalettes();
    const manifest = JSON.parse(await readFile(path.join(fixtureRoot, 'manifest.json'), 'utf8')) as unknown;
    assert.ok(isPlainObject(manifest));
    assert.deepEqual(manifest.totals, { active: 2057, deprecated: 232 });
    assert.ok(Array.isArray(manifest.palettes));
    assert.equal(manifest.palettes.length, 10);

    const figmaFixture = JSON.parse(await readFile(figmaFixturePath, 'utf8')) as unknown;
    assertNoPrivateFigmaMetadata(figmaFixture);
    assert.ok(isPlainObject(figmaFixture));
    assert.ok(isPlainObject(figmaFixture.document));
    assert.ok(Array.isArray(figmaFixture.document.children));
    assert.deepEqual(
        figmaFixture.document.children.map((page) => isPlainObject(page) ? page.name : undefined),
        palettes.map((palette) => palette.figma.pageName),
    );

    const checkResults = await runPalettes({
        palettes,
        repoRoot: fixtureRepository,
        figmaJsonPath: figmaFixturePath,
        check: true,
    });
    assert.equal(checkResults.length, 10);
    assert.equal(checkResults.every((result) => !result.changed), true);
    assert.equal(checkResults.reduce((sum, result) => sum + result.summary.activeTokens, 0), 2057);
    assert.equal(checkResults.reduce((sum, result) => sum + result.summary.deprecatedTokens, 0), 232);
    // Слепок normalized-json восстанавливает только данные JSON. Служебные
    // `empty` не являются данными токена, поэтому в таком слепке их нет.
    assert.equal(checkResults.reduce((sum, result) => sum + result.summary.placeholders, 0), 0);

    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-full-fixture-'));
    try {
        await cp(fixtureRepository, temporaryRoot, { recursive: true });
        const expectedTexts = new Map(await Promise.all(palettes.map(async (palette) => [
            palette.targetJson,
            await readFile(path.join(fixtureRepository, palette.targetJson), 'utf8'),
        ] as const)));

        await runPalettes({
            palettes,
            repoRoot: temporaryRoot,
            figmaJsonPath: figmaFixturePath,
        });
        for (const palette of palettes) {
            assert.equal(
                await readFile(path.join(temporaryRoot, palette.targetJson), 'utf8'),
                expectedTexts.get(palette.targetJson),
                `${palette.targetJson} изменился после идемпотентного запуска`,
            );
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});
