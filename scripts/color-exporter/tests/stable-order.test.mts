import assert from 'node:assert/strict';
import test from 'node:test';

import {
    compareCodeUnits,
    compareTokenKeys,
    sortTokenEntries,
    sortTokenKeys,
} from '../src/core/stable-order.mjs';

test('ключи сортируются по явному неизменному алфавиту', () => {
    const input = [
        'light_accent_2',
        'light_accent_100',
        'light_accent_10_inverted',
        'light_accent_10',
        'light_accent_1',
    ];

    assert.deepEqual(sortTokenKeys(input), [
        'light_accent_1',
        'light_accent_10',
        'light_accent_10_inverted',
        'light_accent_100',
        'light_accent_2',
    ]);
    assert.deepEqual(input, [
        'light_accent_2',
        'light_accent_100',
        'light_accent_10_inverted',
        'light_accent_10',
        'light_accent_1',
    ]);
});

test('сортировка пар не теряет связь ключа со значением', () => {
    const entries: Array<readonly [string, number]> = [
        ['z_token', 2],
        ['a_token', 1],
    ];

    assert.deepEqual(sortTokenEntries(entries), [
        ['a_token', 1],
        ['z_token', 2],
    ]);
    assert.deepEqual(entries, [
        ['z_token', 2],
        ['a_token', 1],
    ]);
});

test('недопустимые символы в ключе останавливают сортировку', () => {
    assert.throws(() => sortTokenKeys(['valid_key', 'Invalid-Key']), /только a-z, 0-9 и _/);
    assert.throws(() => compareTokenKeys('valid_key', 'bad/key'), /правый ключ/);
});

test('ключи-индексы JavaScript запрещены, остальные числовые строки сохраняют порядок', () => {
    for (const key of ['0', '2', '4294967294']) {
        assert.throws(() => sortTokenKeys([key]), /целочисленным индексом JavaScript/);
        assert.throws(() => sortTokenEntries([[key, {}]]), /целочисленным индексом JavaScript/);
    }
    assert.deepEqual(sortTokenKeys(['4294967295', '01', '00']), ['00', '01', '4294967295']);
});

test('технические имена сравниваются без зависимости от локали', () => {
    assert.equal(compareCodeUnits('brand.mjs', 'x5.mjs'), -1);
    assert.equal(compareCodeUnits('x5.mjs', 'brand.mjs'), 1);
    assert.equal(compareCodeUnits('go.mjs', 'go.mjs'), 0);
});
