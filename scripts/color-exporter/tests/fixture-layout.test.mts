import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseFigmaPalette } from '../src/core/parse-layout.mjs';
import bluetint from '../src/palettes/bluetint.mjs';
import {
    SANITIZED_STYLE_ID,
    SANITIZED_VARIABLE_ID,
    sanitizeFigmaFixture,
} from '../tools/fixture-layout.mjs';
import { sourceFile } from './test-paths.mjs';

const fixturePath = sourceFile('tests', 'fixtures', 'bluetint-figma.json');

test('обезличивание сохраняет привязки, но удаляет настоящие идентификаторы', async () => {
    const source = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown;
    const expectedTokens = parseFigmaPalette(source, bluetint).tokens;
    const sanitized = sanitizeFigmaFixture(source, [bluetint]);
    const serialized = JSON.stringify(sanitized);

    assert.equal(serialized.includes('S:light-accent-primary-default'), false);
    assert.equal(serialized.includes('VariableID:light-accent-primary-hover'), false);
    assert.equal(serialized.includes('VariableID:light-transparent-inverted-default-press'), false);
    assert.equal(serialized.includes(SANITIZED_STYLE_ID), true);
    assert.equal(serialized.includes(SANITIZED_VARIABLE_ID), true);
    assert.deepEqual(parseFigmaPalette(sanitized, bluetint).tokens, expectedTokens);
});
