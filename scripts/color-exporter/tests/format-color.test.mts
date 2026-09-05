import assert from 'node:assert/strict';
import test from 'node:test';

import { formatRectangleColor } from '../src/core/format-color.mjs';
import type { JsonObject } from '../src/core/types.mjs';

const VARIABLE_ALIAS = Object.freeze({
    type: 'VARIABLE_ALIAS',
    id: 'VariableID:тестовый-цвет',
});

function nodeVariableRectangle(fill: JsonObject, extra: JsonObject = {}): JsonObject {
    return {
        name: 'default',
        fills: [fill],
        boundVariables: { fills: [VARIABLE_ALIAS] },
        ...extra,
    };
}

function solidFill(color: JsonObject = { r: 0, g: 0, b: 0 }): JsonObject {
    return { type: 'SOLID', color };
}

test('альфа округляется одинаково для rgba и ARGB-hex', () => {
    const result = formatRectangleColor(nodeVariableRectangle(
        solidFill({ r: 1, g: 0.5, b: 0, a: 0.704 }),
        { opacity: 1 },
    ));

    assert.deepEqual(result, {
        rgba: 'rgba(255, 128, 0, 0.7)',
        hex: '#b3ff8000',
    });
});

test('цвет допускает привязку переменной на узле, на заливке или через цветовой стиль Figma', () => {
    const paintVariable = solidFill();
    paintVariable.boundVariables = { color: VARIABLE_ALIAS };
    const paintStyle = {
        name: 'default',
        fills: [solidFill()],
        styles: { fill: 'S:тестовый-цветовой-стиль' },
    };

    for (const rectangle of [
        nodeVariableRectangle(solidFill()),
        { name: 'default', fills: [paintVariable] },
        paintStyle,
    ]) {
        assert.deepEqual(formatRectangleColor(rectangle), {
            rgba: 'rgba(0, 0, 0, 1)',
            hex: '#000000',
        });
    }
});

test('ручная заливка без переменной или стиля запрещена', () => {
    assert.throws(
        () => formatRectangleColor({ name: 'default', fills: [solidFill()] }),
        /должна быть привязана к цветовой переменной или стилю Figma/,
    );
});

test('содержательный прямоугольник обязан иметь ровно одну видимую SOLID-заливку без скрытых дополнительных', () => {
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [],
            styles: { fill: 'S:цвет' },
        }),
        /ровно одну заливку всего; она должна быть видимой и сплошной/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [solidFill(), { ...solidFill(), visible: false }],
            styles: { fill: 'S:цвет' },
        }),
        /ровно одну заливку всего; она должна быть видимой и сплошной/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [{ ...solidFill(), visible: false }],
            styles: { fill: 'S:цвет' },
        }),
        /ровно одну заливку всего; она должна быть видимой и сплошной/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [{ type: 'GRADIENT_LINEAR' }],
            styles: { fill: 'S:цвет' },
        }),
        /ровно одну заливку всего; она должна быть видимой и сплошной/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [solidFill(), 'повреждённая заливка'],
        }),
        /заливка 1 прямоугольника default должна быть объектом/,
    );
});

test('неправильные идентификаторы привязок не считаются переменной или стилем', () => {
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [solidFill()],
            styles: { fill: '' },
        }),
        /идентификатор стиля заливки должен быть непустой строкой/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [solidFill()],
            boundVariables: { fills: [] },
        }),
        /должна содержать один VARIABLE_ALIAS/,
    );
    assert.throws(
        () => formatRectangleColor({
            name: 'default',
            fills: [{ ...solidFill(), boundVariables: { color: { type: 'VARIABLE_ALIAS', id: '' } } }],
        }),
        /color должен быть VARIABLE_ALIAS/,
    );
});

test('каналы и прозрачность не могут выходить за диапазон 0–1', () => {
    assert.throws(
        () => formatRectangleColor(nodeVariableRectangle(
            solidFill({ r: 1.01, g: 0, b: 0 }),
        )),
        /Красный канал должен быть числом от 0 до 1/,
    );
});

test('явный null не подменяется непрозрачностью 1', () => {
    for (const rectangle of [
        nodeVariableRectangle(solidFill({ r: 0, g: 0, b: 0, a: null })),
        nodeVariableRectangle({ ...solidFill(), opacity: null }),
        nodeVariableRectangle(solidFill(), { opacity: null }),
    ]) {
        assert.throws(() => formatRectangleColor(rectangle), /числом от 0 до 1/);
    }
});
