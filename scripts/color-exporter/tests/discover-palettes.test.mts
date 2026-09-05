import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { discoverPalettes } from '../src/core/discover-palettes.mjs';

interface ModuleSourceOptions {
    id?: string;
    pageName?: string;
    targetJson?: string;
}

function moduleSource(options: ModuleSourceOptions = {}): string {
    const id = options.id ?? 'example';
    const pageName = options.pageName ?? `colors_${id}.json`;
    const targetJson = options.targetJson ?? `styles/${pageName}`;
    return `
const noOperation = () => {};
export default {
    id: '${id}',
    description: 'Учебная палитра',
    figma: { pageName: '${pageName}' },
    targetJson: '${targetJson}',
    stateNames: ['default'],
    validateSectionName: noOperation,
    validateFrameName: noOperation,
    validateFrameComposition: noOperation,
    deriveIdentity: noOperation,
    makeToken: noOperation,
};
`;
}

function directoryUrl(directoryPath: string): URL {
    return pathToFileURL(`${directoryPath}${path.sep}`);
}

test('каталог палитр автоматически обнаруживает все десять независимых модулей', async () => {
    const palettes = await discoverPalettes();
    assert.deepEqual(palettes.map((palette) => palette.id), [
        'bluetint',
        'brand',
        'decorative',
        'go',
        'monochrome',
        'promo',
        'qualitative',
        'sequential',
        'students',
        'x5',
    ]);
    assert.deepEqual(palettes.map((palette) => palette.targetJson), [
        'styles/colors_bluetint.json',
        'styles/colors_brand.json',
        'styles/colors_decorative.json',
        'styles/colors_go.json',
        'styles/colors_monochrome.json',
        'styles/colors_promo.json',
        'styles/colors_qualitative.json',
        'styles/colors_sequential.json',
        'styles/colors_students.json',
        'styles/colors_x5.json',
    ]);
    assert.equal(palettes.every((palette) => Object.isFrozen(palette)), true);
    assert.equal(palettes.every((palette) => Object.isFrozen(palette.figma)), true);
    assert.equal(palettes.every((palette) => Object.isFrozen(palette.stateNames)), true);
});

test('добавленный модуль находится без правки реестра, а служебный файл игнорируется', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        await Promise.all([
            writeFile(path.join(temporaryRoot, 'example.mjs'), moduleSource(), 'utf8'),
            writeFile(path.join(temporaryRoot, '_helper.mjs'), 'throw new Error("helper не должен импортироваться");', 'utf8'),
        ]);

        const palettes = await discoverPalettes(directoryUrl(temporaryRoot));
        assert.deepEqual(palettes.map((palette) => palette.id), ['example']);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('пустой каталог особых правил допустим для стандартных страниц', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        assert.deepEqual(await discoverPalettes(directoryUrl(temporaryRoot)), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('порядок полей определения модуля не меняет его контракт', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        const source = moduleSource().replace(
            "id: 'example',\n    description: 'Учебная палитра',",
            "description: 'Учебная палитра',\n    id: 'example',",
        );
        await writeFile(path.join(temporaryRoot, 'example.mjs'), source, 'utf8');
        assert.deepEqual((await discoverPalettes(directoryUrl(temporaryRoot))).map(({ id }) => id), ['example']);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('имя файла модуля обязано совпадать с id', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        await writeFile(path.join(temporaryRoot, 'wrong-name.mjs'), moduleSource(), 'utf8');
        await assert.rejects(
            discoverPalettes(directoryUrl(temporaryRoot)),
            /имя файла должно совпадать с id example/,
        );
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('имя страницы Figma обязано совпадать с именем JSON', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        await writeFile(path.join(temporaryRoot, 'example.mjs'), moduleSource({
            targetJson: 'styles/colors_other.json',
        }), 'utf8');
        await assert.rejects(
            discoverPalettes(directoryUrl(temporaryRoot)),
            /целевой JSON должен лежать в styles и совпадать с именем страницы Figma/,
        );
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('модуль палитры не может указать другой Figma-файл', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        const source = moduleSource().replace(
            "figma: { pageName:",
            "figma: { fileKey: 'другой-файл', pageName:",
        );
        await writeFile(path.join(temporaryRoot, 'example.mjs'), source, 'utf8');
        await assert.rejects(
            discoverPalettes(directoryUrl(temporaryRoot)),
            /настройки Figma: ожидались поля pageName, получены fileKey, pageName/,
        );
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('модуль палитры не может переопределить обработку empty', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-discovery-'));
    try {
        const source = moduleSource().replace(
            'validateFrameComposition: noOperation,',
            'isPlaceholder: () => false,\n    validateFrameComposition: noOperation,',
        );
        await writeFile(path.join(temporaryRoot, 'example.mjs'), source, 'utf8');
        await assert.rejects(
            discoverPalettes(directoryUrl(temporaryRoot)),
            /определение палитры: ожидались поля .*validateFrameComposition.*получены .*isPlaceholder/,
        );
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});
