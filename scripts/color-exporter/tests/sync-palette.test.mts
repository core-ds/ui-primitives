import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseFigmaPalette } from '../src/core/parse-layout.mjs';
import { sortTokenKeys } from '../src/core/stable-order.mjs';
import { synchronizePalette } from '../src/core/sync-palette.mjs';
import bluetint from '../src/palettes/bluetint.mjs';
import { sourceFile } from './test-paths.mjs';

const figmaFixturePath = sourceFile('tests', 'fixtures', 'bluetint-figma.json');
const codeFixturePath = sourceFile('tests', 'fixtures', 'bluetint-code-before.json');

test('синхронизация создаёт новые токены, исправляет старые и переносит устаревшие в хвост', async () => {
    const figmaFile = JSON.parse(await readFile(figmaFixturePath, 'utf8'));
    const oldPalette = JSON.parse(await readFile(codeFixturePath, 'utf8'));
    const parsed = parseFigmaPalette(figmaFile, bluetint);
    const result = synchronizePalette(oldPalette, parsed.tokens);
    const keys = Object.keys(result.palette);
    const primary = result.palette.light_accent_primary;
    const oldToken = result.palette.light_old_token;
    const historical = result.palette.z_historical;
    const primaryHover = result.palette.light_accent_primary_hover;
    assert.ok(primary);
    assert.ok(oldToken);
    assert.ok(historical);
    assert.ok(primaryHover);

    assert.deepEqual(keys.slice(0, 4), sortTokenKeys(parsed.tokens.keys()));
    assert.deepEqual(keys.slice(4), ['light_old_token', 'z_historical']);
    assert.deepEqual(Object.keys(primary), ['rgba', 'hex', 'figma', 'web', 'alias']);
    assert.deepEqual(Object.keys(oldToken), ['rgba', 'hex', 'web', 'alias', 'deprecated']);
    assert.deepEqual(Object.keys(historical), ['deprecated', 'rgba', 'hex', 'web', 'alias']);
    assert.equal(primary.alias, 'accentColorPrimary');
    assert.equal(primaryHover.web, '--color-light-accent-primary-hover');
    assert.deepEqual(result.summary, {
        oldTokens: 3,
        resultTokens: 6,
        activeTokens: 4,
        deprecatedTokens: 2,
        newTokens: 3,
        restoredTokens: 0,
        changedActiveTokens: 1,
        newlyDeprecatedTokens: 1,
    });
    assert.deepEqual(result.changes, {
        newTokenKeys: [
            'light_accent_primary_hover',
            'light_transparent_default_inverted_hover',
            'light_transparent_default_inverted_press',
        ],
        restoredTokenKeys: [],
        changedActiveTokenKeys: ['light_accent_primary'],
        newlyDeprecatedTokenKeys: ['light_old_token'],
    });
});

test('повторная синхронизация уже готового результата ничего не меняет', async () => {
    const figmaFile = JSON.parse(await readFile(figmaFixturePath, 'utf8'));
    const oldPalette = JSON.parse(await readFile(codeFixturePath, 'utf8'));
    const parsed = parseFigmaPalette(figmaFile, bluetint);
    const first = synchronizePalette(oldPalette, parsed.tokens);
    const second = synchronizePalette(first.palette, parsed.tokens);

    assert.equal(JSON.stringify(second.palette), JSON.stringify(first.palette));
    assert.equal(second.summary.newTokens, 0);
    assert.equal(second.summary.changedActiveTokens, 0);
    assert.equal(second.summary.newlyDeprecatedTokens, 0);
});

test('все модули используют один явный порядок по полному ключу', () => {
    const oldPalette = {};
    const parsedTokens = new Map([
        ['item_10', { value: '10' }],
        ['item_2', { value: '2' }],
        ['item_10_inverted', { value: '10_inverted' }],
        ['item_100', { value: '100' }],
    ]);
    const result = synchronizePalette(oldPalette, parsedTokens);

    assert.deepEqual(Object.keys(result.palette), [
        'item_10',
        'item_10_inverted',
        'item_100',
        'item_2',
    ]);
});

test('возвращённый из deprecated токен полностью заменяется новым объектом', () => {
    const oldPalette = {
        light_accent_primary: {
            rgba: 'rgba(0, 0, 0, 1)',
            deprecated: true,
        },
    };
    const generatedToken = {
        rgba: 'rgba(1, 2, 3, 1)',
        hex: '#010203',
        figma: 'accent/primary',
        web: '--color-light-accent-primary',
        alias: 'accentColorPrimary',
    };
    const result = synchronizePalette(oldPalette, new Map([
        ['light_accent_primary', generatedToken],
    ]));

    assert.deepEqual(result.palette.light_accent_primary, generatedToken);
    assert.deepEqual(result.changes.restoredTokenKeys, ['light_accent_primary']);
    assert.deepEqual(result.changes.changedActiveTokenKeys, []);
    assert.equal(result.summary.restoredTokens, 1);
    assert.equal(result.summary.changedActiveTokens, 0);
});

test('имя constructor считается новым токеном, а не свойством прототипа Object', () => {
    const generatedToken = { value: 'новый токен' };
    const result = synchronizePalette({}, new Map([
        ['constructor', generatedToken],
    ]));

    assert.equal(Object.hasOwn(result.palette, 'constructor'), true);
    assert.deepEqual(result.palette.constructor, generatedToken);
    assert.deepEqual(result.changes.newTokenKeys, ['constructor']);
});

test('исторический ключ-индекс не может оказаться перед активными токенами', () => {
    assert.throws(() => synchronizePalette(
        { '2': { value: 'старое значение' } },
        new Map([['active', { value: 'новое значение' }]]),
    ), /целочисленным индексом JavaScript/);
});
