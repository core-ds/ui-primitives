import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseFigmaPalette } from '../src/core/parse-layout.mjs';
import bluetint, {
    deriveBluetintIdentity,
    makeBluetintAlias,
    makeBluetintToken,
} from '../src/palettes/bluetint.mjs';
import { sourceFile } from './test-paths.mjs';

const fixturePath = sourceFile('tests', 'fixtures', 'bluetint-figma.json');

test('BlueTint стабильно строит ключ и путь для inverted и hover', () => {
    assert.deepEqual(
        deriveBluetintIdentity({
            sectionName: 'dark/accent_inverted',
            frameName: 'primary',
            stateName: 'hover',
        }),
        {
            key: 'dark_accent_primary_inverted_hover',
            figma: 'accent_inverted/primary/hover',
            mode: 'dark',
        },
    );
});

test('BlueTint стабильно строит alias для динамической и статической семьи', () => {
    assert.equal(makeBluetintAlias('accent_inverted/primary', 'default'), 'accentColorPrimaryInverted');
    assert.equal(makeBluetintAlias('static_neutral-translucent/100/press', 'press'), 'staticNeutralTranslucentColor100Press');
});

test('новый токен всегда получает пять полей в каноническом порядке', () => {
    const token = makeBluetintToken({
        stateName: 'default',
        identity: {
            key: 'dark_accent_primary_inverted',
            figma: 'accent_inverted/primary',
            mode: 'dark',
        },
        color: {
            rgba: 'rgba(239, 49, 36, 1)',
            hex: '#ef3124',
        },
    });

    assert.deepEqual(token, {
        rgba: 'rgba(239, 49, 36, 1)',
        hex: '#ef3124',
        figma: 'accent_inverted/primary',
        web: '--color-dark-accent-primary-inverted',
        alias: 'accentColorPrimaryInverted',
    });
    assert.deepEqual(Object.keys(token), ['rgba', 'hex', 'figma', 'web', 'alias']);
});

test('парсер игнорирует empty, но считает физические прямоугольники', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    const result = parseFigmaPalette(figmaFile, bluetint);

    assert.deepEqual(result.counts, {
        sections: 2,
        frames: 2,
        rectangles: 5,
        placeholders: 1,
        tokens: 4,
    });
    assert.equal(result.tokens.has('light_transparent_default_inverted_hover'), true);
    assert.equal([...result.tokens.keys()].some((key) => key.includes('empty')), false);
});

test('empty можно повторять в любом месте без изменения экспортируемых токенов', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    const original = parseFigmaPalette(figmaFile, bluetint);
    const frame = figmaFile.document.children[0].children[1].children[0];
    const empty = frame.children.shift();
    assert.ok(empty);
    frame.children.splice(1, 0, empty);
    frame.children.push(structuredClone(empty));

    const result = parseFigmaPalette(figmaFile, bluetint);
    assert.deepEqual(result.tokens, original.tokens);
    assert.deepEqual(result.counts, {
        sections: 2,
        frames: 2,
        rectangles: 6,
        placeholders: 2,
        tokens: 4,
    });
});

test('empty игнорируется без чтения размеров, заливок, обводок и привязок', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    const empty = figmaFile.document.children[0].children[1].children[0].children[0];
    delete empty.absoluteBoundingBox;
    delete empty.strokes;
    empty.fills = [{ type: 'IMAGE' }];
    empty.styles = { fill: 'любой-идентификатор' };

    const result = parseFigmaPalette(figmaFile, bluetint);
    assert.equal(result.counts.placeholders, 1);
    assert.equal(result.tokens.size, 4);
    assert.equal([...result.tokens.keys()].some((key) => key.includes('empty')), false);
});

test('фрейм из одной empty-заглушки не может бесследно исчезнуть из JSON', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    const frame = figmaFile.document.children[0].children[1].children[0];
    frame.children = [frame.children[0]];

    assert.throws(
        () => parseFigmaPalette(figmaFile, bluetint),
        /не содержит ни одного цветового состояния/,
    );
});

test('особый модуль не может разрешить фрейм только из empty', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    const frame = figmaFile.document.children[0].children[1].children[0];
    frame.children = [frame.children[0]];
    const permissivePalette = { ...bluetint, validateFrameComposition() {} };

    assert.throws(
        () => parseFigmaPalette(figmaFile, permissivePalette),
        /не содержит ни одного цветового состояния/,
    );
});

test('повторы секций, фреймов и состояний останавливают экспорт', async () => {
    const original = JSON.parse(await readFile(fixturePath, 'utf8'));

    const duplicateSection = structuredClone(original);
    duplicateSection.document.children[0].children.push(
        structuredClone(duplicateSection.document.children[0].children[0]),
    );
    assert.throws(() => parseFigmaPalette(duplicateSection, bluetint), /секция light\/accent повторяется/);

    const duplicateFrame = structuredClone(original);
    const section = duplicateFrame.document.children[0].children[0];
    section.children.push(structuredClone(section.children[0]));
    assert.throws(() => parseFigmaPalette(duplicateFrame, bluetint), /фрейм light\/accent\/primary повторяется/);

    const duplicateState = structuredClone(original);
    const frame = duplicateState.document.children[0].children[0].children[0];
    frame.children.push(structuredClone(frame.children[1]));
    assert.throws(() => parseFigmaPalette(duplicateState, bluetint), /состояние light\/accent\/primary\/hover повторяется/);
});

test('парсер требует ровно одну экспортную страницу', async () => {
    const figmaFile = JSON.parse(await readFile(fixturePath, 'utf8'));
    figmaFile.document.children.push(structuredClone(figmaFile.document.children[0]));

    assert.throws(
        () => parseFigmaPalette(figmaFile, bluetint),
        /ожидалась ровно одна страница colors_bluetint\.json, найдено 2/,
    );
});
