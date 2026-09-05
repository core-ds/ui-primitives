import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseFigmaPalette } from '../src/core/parse-layout.mjs';
import { runPalettes } from '../src/core/run-palettes.mjs';
import type { JsonObject, PaletteDefinition, PaletteIdentity } from '../src/core/types.mjs';
import { createStandardPaletteForPage } from '../src/palettes/_create-standard.mjs';
import x5 from '../src/palettes/x5.mjs';

const PAGE_NAME = 'colors_collision.json';
const standard = createStandardPaletteForPage({ pageName: PAGE_NAME });

function frame(name: string, stateName = 'default', nodeId?: string): JsonObject {
    return {
        type: 'FRAME',
        name,
        children: [{
            type: 'RECTANGLE',
            name: stateName,
            ...(nodeId === undefined ? {} : { id: nodeId }),
            styles: { fill: 'S:тестовый-цвет' },
            fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } }],
        }],
    };
}

function section(name: string, ...frames: JsonObject[]): JsonObject {
    return { type: 'SECTION', name, children: frames };
}

function page(name: string, ...sections: JsonObject[]): JsonObject {
    return { type: 'CANVAS', name, children: sections };
}

function file(...pages: JsonObject[]): JsonObject {
    return { document: { children: pages } };
}

function rejectCollision(
    figmaFile: JsonObject,
    field: string,
    value: string,
    sourceParts: string[],
    keys: string[],
    palette: PaletteDefinition = standard,
): void {
    assert.throws(() => parseFigmaPalette(figmaFile, palette), (error: unknown) => {
        assert.ok(error instanceof Error);
        for (const fragment of [field, value, palette.figma.pageName, ...sourceParts, ...keys]) {
            assert.ok(error.message.includes(fragment), `В ошибке отсутствует ${JSON.stringify(fragment)}: ${error.message}`);
        }
        return true;
    });
}

test('разные фреймы x1 и x-1 не могут получить один alias в одном режиме', () => {
    rejectCollision(file(page(PAGE_NAME, section('light/accent',
        frame('x1', 'default', '10:1'),
        frame('x-1', 'default', '10:2'),
    ))), 'alias', 'accentColorX1', ['light/accent', 'x1', 'x-1', 'default', '10:1', '10:2'], [
        'light_accent_x1', 'light_accent_x_1',
    ]);
});

test('дефис и подчёркивание в семье не могут дать одинаковый ключ', () => {
    rejectCollision(file(page(PAGE_NAME,
        section('light/family-name', frame('primary', 'default', '11:1')),
        section('light/family_name', frame('primary', 'default', '11:2')),
    )), 'key', 'light_family_name_primary', [
        'light/family-name', 'light/family_name', 'primary', 'default', '11:1', '11:2',
    ], ['light_family_name_primary']);
});

test('разные вложенные семьи проверяются на один alias после преобразования пути', () => {
    rejectCollision(file(page(PAGE_NAME,
        section('light/a/b1', frame('primary', 'default', '12:1')),
        section('light/a-b/1', frame('primary', 'default', '12:2')),
    )), 'alias', 'aB1ColorPrimary', ['light/a/b1', 'light/a-b/1', 'primary', 'default', '12:1', '12:2'], [
        'light_a_b1_primary', 'light_a_b_1_primary',
    ]);
});

test('default фрейма primary-hover конфликтует с настоящим состоянием hover', () => {
    rejectCollision(file(page(PAGE_NAME, section('light/accent',
        frame('primary-hover', 'default', '13:1'),
        frame('primary', 'hover', '13:2'),
    ))), 'key', 'light_accent_primary_hover', [
        'light/accent', 'primary-hover', 'primary', 'default', 'hover', '13:1', '13:2',
    ], ['light_accent_primary_hover']);
});

test('особый модуль не может вернуть одинаковое поле web для разных токенов', () => {
    const palette: PaletteDefinition = {
        ...standard,
        makeToken(context) {
            return { ...standard.makeToken(context), web: '--color-shared' };
        },
    };
    rejectCollision(file(page(PAGE_NAME, section('light/accent',
        frame('primary', 'default', '14:1'),
        frame('secondary', 'default', '14:2'),
    ))), 'web', '--color-shared', ['light/accent', 'primary', 'secondary', 'default', '14:1', '14:2'], [
        'light_accent_primary', 'light_accent_secondary',
    ], palette);
});

test('особый модуль не может привязать два ключа к одному пути Figma в одном режиме', () => {
    const palette: PaletteDefinition = {
        ...standard,
        deriveIdentity(context) {
            return { ...standard.deriveIdentity(context), figma: 'accent/shared' };
        },
    };
    rejectCollision(file(page(PAGE_NAME, section('light/accent',
        frame('primary', 'default', '15:1'),
        frame('secondary', 'default', '15:2'),
    ))), 'figma', 'accent/shared', ['light/accent', 'primary', 'secondary', 'default', '15:1', '15:2'], [
        'light_accent_primary', 'light_accent_secondary',
    ], palette);
});

test('ключ уникален для всей палитры даже между разными режимами', () => {
    const palette: PaletteDefinition = {
        ...standard,
        deriveIdentity(context) {
            return { ...standard.deriveIdentity(context), key: 'shared_primary' };
        },
    };
    rejectCollision(file(page(PAGE_NAME,
        section('light/accent', frame('primary', 'default', '16:1')),
        section('dark/accent', frame('primary', 'default', '16:2')),
    )), 'key', 'shared_primary', ['light/accent', 'dark/accent', 'primary', 'default', '16:1', '16:2'], [
        'shared_primary',
    ], palette);
});

test('поле web уникально для всей палитры даже между разными режимами', () => {
    const palette: PaletteDefinition = {
        ...standard,
        makeToken(context) {
            return { ...standard.makeToken(context), web: '--color-shared-primary' };
        },
    };
    rejectCollision(file(page(PAGE_NAME,
        section('light/accent', frame('primary', 'default', '17:1')),
        section('dark/accent', frame('primary', 'default', '17:2')),
    )), 'web', '--color-shared-primary', ['light/accent', 'dark/accent', '17:1', '17:2'], [
        'light_accent_primary', 'dark_accent_primary',
    ], palette);
});

test('режим обязателен и не восстанавливается по имени секции или ключу', () => {
    for (const mode of [undefined, '', 42]) {
        const palette: PaletteDefinition = {
            ...standard,
            deriveIdentity(context) {
                const { key, figma } = standard.deriveIdentity(context);
                return { key, figma, ...(mode === undefined ? {} : { mode }) } as PaletteIdentity;
            },
        };
        assert.throws(() => parseFigmaPalette(file(page(PAGE_NAME,
            section('light/accent', frame('primary')),
        )), palette), /mode|режим/);
    }
});

test('одинаковые alias и пути Figma допустимы в разных режимах', () => {
    const parsed = parseFigmaPalette(file(page(PAGE_NAME,
        section('light/accent', frame('primary')),
        section('dark/accent', frame('primary')),
    )), standard);
    assert.deepEqual([...parsed.tokens.keys()], ['light_accent_primary', 'dark_accent_primary']);
    const tokens = [...parsed.tokens.values()];
    assert.deepEqual(tokens.map(({ alias }) => alias), ['accentColorPrimary', 'accentColorPrimary']);
    assert.deepEqual(tokens.map(({ figma }) => figma), ['accent/primary', 'accent/primary']);
    for (const token of tokens) {
        assert.deepEqual(Object.keys(token), ['rgba', 'hex', 'figma', 'web', 'alias']);
    }
});

test('совпадение rgba и hex у разных имён не является коллизией', () => {
    const parsed = parseFigmaPalette(file(page(PAGE_NAME, section('light/accent',
        frame('primary'), frame('secondary'),
    ))), standard);
    assert.equal(parsed.tokens.size, 2);
    assert.deepEqual([...parsed.tokens.values()].map(({ rgba, hex }) => [rgba, hex]), [
        ['rgba(51, 102, 153, 1)', '#336699'],
        ['rgba(51, 102, 153, 1)', '#336699'],
    ]);
});

test('буквальный путь X5 static/brand продолжает давать отдельные токены', () => {
    const parsed = parseFigmaPalette(file(page('colors_x5.json', section('static/brand',
        frame('primary'), frame('secondary'),
    ))), x5);
    assert.deepEqual([...parsed.tokens.keys()], ['static_brand_primary', 'static_brand_secondary']);
    assert.equal(parsed.tokens.get('static_brand_primary')?.figma, 'static/brand/primary');
    assert.deepEqual(x5.deriveIdentity({
        sectionName: 'static/brand', frameName: 'primary', stateName: 'default',
    }), { key: 'static_brand_primary', figma: 'static/brand/primary', mode: 'static' });
});

test('совпадающие имена в разных палитрах не делят общий реестр', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-scopes-'));
    try {
        await mkdir(path.join(temporaryRoot, 'styles'));
        const palettes = ['colors_alpha.json', 'colors_beta.json'].map((pageName) => (
            createStandardPaletteForPage({ pageName })
        ));
        const figmaFile = file(...palettes.map((palette) => page(palette.figma.pageName,
            section('light/accent', frame('primary')),
        )));
        const results = await runPalettes({
            palettes,
            repoRoot: temporaryRoot,
            figmaToken: 'тест',
            check: true,
            fetchImplementation: async () => ({ ok: true, status: 200, json: async () => figmaFile }),
        });
        assert.deepEqual(results.map(({ summary }) => summary.tokens), [1, 1]);
        assert.deepEqual(await readdir(path.join(temporaryRoot, 'styles')), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('коллизия второй палитры оставляет первый JSON и ещё не созданные JSON нетронутыми', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-collision-'));
    try {
        const stylesDirectory = path.join(temporaryRoot, 'styles');
        await mkdir(stylesDirectory);
        const firstPath = path.join(stylesDirectory, 'colors_alpha.json');
        const originalText = '{\n}\n';
        await writeFile(firstPath, originalText);
        const before = await stat(firstPath);
        const figmaFile = file(
            page('colors_alpha.json', section('light/accent', frame('primary'))),
            page('colors_beta.json', section('light/accent', frame('x1'), frame('x-1'))),
            page('colors_gamma.json', section('light/accent', frame('primary'))),
        );
        await assert.rejects(runPalettes({
            palettes: [],
            repoRoot: temporaryRoot,
            figmaToken: 'тест',
            createPaletteForPage: createStandardPaletteForPage,
            fetchImplementation: async () => ({ ok: true, status: 200, json: async () => figmaFile }),
        }), /alias.*accentColorX1/);

        assert.equal(await readFile(firstPath, 'utf8'), originalText);
        const after = await stat(firstPath);
        assert.equal(after.ino, before.ino);
        assert.equal(after.mtimeMs, before.mtimeMs);
        assert.deepEqual(await readdir(stylesDirectory), ['colors_alpha.json']);
        assert.deepEqual(await readdir(temporaryRoot), ['styles']);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});
