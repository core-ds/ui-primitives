import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFigmaPalette } from '../src/core/parse-layout.mjs';
import { synchronizePalette } from '../src/core/sync-palette.mjs';
import go from '../src/palettes/go.mjs';
import students from '../src/palettes/students.mjs';
import x5 from '../src/palettes/x5.mjs';
import type { JsonObject } from '../src/core/types.mjs';

interface RectangleOptions {
    name?: string;
    paintStyle?: boolean;
}

interface RectangleFixture extends JsonObject {
    type: 'RECTANGLE';
    name: string;
    fills: JsonObject[];
    styles?: JsonObject;
    boundVariables?: JsonObject;
}

interface ChildrenFixture extends JsonObject {
    type: 'FRAME' | 'SECTION' | 'CANVAS';
    name: string;
    children: JsonObject[];
}

function colorFromHex(hex: string): JsonObject {
    const value = Number.parseInt(hex.slice(1), 16);
    return {
        r: ((value >> 16) & 0xff) / 255,
        g: ((value >> 8) & 0xff) / 255,
        b: (value & 0xff) / 255,
        a: 1,
    };
}

function makeRectangle(hex: string, { name = 'default', paintStyle = false }: RectangleOptions = {}): RectangleFixture {
    const rectangle: RectangleFixture = {
        type: 'RECTANGLE',
        name,
        fills: [{
            type: 'SOLID',
            color: colorFromHex(hex),
        }],
    };
    if (paintStyle) {
        // REST уже разрешает цветовой стиль Figma в итоговую заливку. Идентификатор
        // стиля нужен только для доказательства, что парсер от него не зависит.
        rectangle.styles = { fill: 'S:пример-цветового-стиля' };
    } else {
        rectangle.boundVariables = {
            fills: [{ type: 'VARIABLE_ALIAS', id: `VariableID:${name}` }],
        };
    }
    return rectangle;
}

function makeEmpty(): RectangleFixture {
    return {
        type: 'RECTANGLE',
        name: 'empty',
        fills: [],
        strokes: [],
        absoluteBoundingBox: { width: 100, height: 100 },
    };
}

function makeFrame(name: string, hex: string, options: RectangleOptions = {}): ChildrenFixture {
    return {
        type: 'FRAME',
        name,
        children: [makeRectangle(hex, options)],
    };
}

function makeSection(name: string, frames: JsonObject[]): ChildrenFixture {
    return {
        type: 'SECTION',
        name,
        children: frames,
    };
}

function makePage(name: string, sections: JsonObject[]): ChildrenFixture {
    return {
        type: 'CANVAS',
        name,
        children: sections,
    };
}

function makeFigmaFile(pages: JsonObject[]): JsonObject {
    return { document: { children: pages } };
}

function makeStudentsPage(extraFrames: JsonObject[] = []): ChildrenFixture {
    return makePage('colors_students.json', [
        makeSection('static_students', [
            makeFrame('electric-lime', '#8fff00'),
            makeFrame('razzle-rose', '#fe34c6'),
            ...extraFrames,
        ]),
    ]);
}

function makeGoPage(): ChildrenFixture {
    return makePage('colors_go.json', [
        makeSection('light/go', [
            makeFrame('lilac', '#f6ebff'),
            makeFrame('violet', '#7a38e0'),
        ]),
        makeSection('dark/go', [
            makeFrame('lilac', '#2b213a'),
            makeFrame('violet', '#7b54eb'),
        ]),
        makeSection('static_go', [
            makeFrame('lime', '#90e978'),
            makeFrame('toxic', '#64e34b'),
            makeFrame('violet', '#7a38e0'),
        ]),
    ]);
}

function makeX5Page(): ChildrenFixture {
    return makePage('colors_x5.json', [
        makeSection('static/brand', [
            makeFrame('primary', '#5faf2d', { paintStyle: true }),
            makeFrame('secondary', '#00afff', { paintStyle: true }),
            makeFrame('orange', '#f76100', { paintStyle: true }),
        ]),
    ]);
}

test('Students нормализует регистр hex и порядок полей, затем становится идемпотентным', () => {
    const oldPalette = {
        static_students_electric_lime: {
            rgba: 'rgba(143, 255, 0, 1)',
            hex: '#8FFF00',
            figma: 'static_students/electric-lime',
            alias: 'staticStudentsColorElectricLime',
            web: '--color-static-students-electric-lime',
        },
        static_students_razzle_rose: {
            rgba: 'rgba(254, 52, 198, 1)',
            hex: '#FE34C6',
            figma: 'static_students/razzle-rose',
            alias: 'staticStudentsColorRazzleRose',
            web: '--color-static-students-razzle-rose',
        },
    };
    const parsed = parseFigmaPalette(makeFigmaFile([makeStudentsPage()]), students);
    const first = synchronizePalette(oldPalette, parsed.tokens);
    const second = synchronizePalette(first.palette, parsed.tokens);

    assert.deepEqual(parsed.counts, {
        sections: 1,
        frames: 2,
        rectangles: 2,
        placeholders: 0,
        tokens: 2,
    });
    assert.deepEqual(first.palette.static_students_electric_lime, {
        rgba: 'rgba(143, 255, 0, 1)',
        hex: '#8fff00',
        figma: 'static_students/electric-lime',
        web: '--color-static-students-electric-lime',
        alias: 'staticStudentsColorElectricLime',
    });
    assert.equal(first.summary.changedActiveTokens, 2);
    assert.equal(JSON.stringify(second.palette), JSON.stringify(first.palette));
    assert.equal(second.summary.changedActiveTokens, 0);
});

test('Go проходит через общий алгоритм без изменений', () => {
    const oldPalette = {
        dark_go_lilac: {
            rgba: 'rgba(43, 33, 58, 1)', hex: '#2b213a', figma: 'go/lilac',
            web: '--color-dark-go-lilac', alias: 'goColorLilac',
        },
        dark_go_violet: {
            rgba: 'rgba(123, 84, 235, 1)', hex: '#7b54eb', figma: 'go/violet',
            web: '--color-dark-go-violet', alias: 'goColorViolet',
        },
        light_go_lilac: {
            rgba: 'rgba(246, 235, 255, 1)', hex: '#f6ebff', figma: 'go/lilac',
            web: '--color-light-go-lilac', alias: 'goColorLilac',
        },
        light_go_violet: {
            rgba: 'rgba(122, 56, 224, 1)', hex: '#7a38e0', figma: 'go/violet',
            web: '--color-light-go-violet', alias: 'goColorViolet',
        },
        static_go_lime: {
            rgba: 'rgba(144, 233, 120, 1)', hex: '#90e978', figma: 'static_go/lime',
            web: '--color-static-go-lime', alias: 'staticGoColorLime',
        },
        static_go_toxic: {
            rgba: 'rgba(100, 227, 75, 1)', hex: '#64e34b', figma: 'static_go/toxic',
            web: '--color-static-go-toxic', alias: 'staticGoColorToxic',
        },
        static_go_violet: {
            rgba: 'rgba(122, 56, 224, 1)', hex: '#7a38e0', figma: 'static_go/violet',
            web: '--color-static-go-violet', alias: 'staticGoColorViolet',
        },
    };
    const parsed = parseFigmaPalette(makeFigmaFile([makeGoPage()]), go);
    const result = synchronizePalette(oldPalette, parsed.tokens);

    assert.deepEqual(result.palette, oldPalette);
    assert.equal(result.summary.activeTokens, 7);
    assert.equal(result.summary.changedActiveTokens, 0);
});

test('X5 читает цветовой стиль Figma, добавляет figma и применяет общий алфавитный порядок', () => {
    const oldPalette = {
        static_brand_primary: {
            rgba: 'rgba(95, 175, 45, 1)',
            hex: '#5faf2d',
            alias: 'staticBrandColorPrimary',
            web: '--color-static-brand-primary',
        },
        static_brand_secondary: {
            rgba: 'rgba(0, 175, 255, 1)',
            hex: '#00afff',
            alias: 'staticBrandColorSecondary',
            web: '--color-static-brand-secondary',
        },
        static_brand_orange: {
            rgba: 'rgba(247, 97, 0, 1)',
            hex: '#f76100',
            figma: 'static/brand/orange',
            alias: 'staticBrandColorOrange',
            web: '--color-static-brand-orange',
        },
    };
    const parsed = parseFigmaPalette(makeFigmaFile([makeX5Page()]), x5);
    const result = synchronizePalette(oldPalette, parsed.tokens);

    assert.deepEqual(Object.keys(result.palette), [
        'static_brand_orange',
        'static_brand_primary',
        'static_brand_secondary',
    ]);
    assert.deepEqual(result.palette.static_brand_secondary, {
        rgba: 'rgba(0, 175, 255, 1)',
        hex: '#00afff',
        figma: 'static/brand/secondary',
        web: '--color-static-brand-secondary',
        alias: 'staticBrandColorSecondary',
    });
    assert.equal(result.summary.changedActiveTokens, 3);
});

test('новый токен добавляется общей формулой, а исчезнувший уходит в отдельный хвост', () => {
    const page = makePage('colors_students.json', [
        makeSection('static_students', [
            makeFrame('electric-lime', '#8fff00'),
            makeFrame('new-accent', '#123456'),
        ]),
    ]);
    const oldPalette = {
        static_students_electric_lime: {
            rgba: 'rgba(143, 255, 0, 1)', hex: '#8fff00', figma: 'static_students/electric-lime',
            web: '--color-static-students-electric-lime', alias: 'staticStudentsColorElectricLime',
        },
        static_students_razzle_rose: {
            rgba: 'rgba(254, 52, 198, 1)', hex: '#fe34c6', figma: 'static_students/razzle-rose',
            web: '--color-static-students-razzle-rose', alias: 'staticStudentsColorRazzleRose',
        },
    };
    const parsed = parseFigmaPalette(makeFigmaFile([page]), students);
    const result = synchronizePalette(oldPalette, parsed.tokens);

    assert.deepEqual(Object.keys(result.palette), [
        'static_students_electric_lime',
        'static_students_new_accent',
        'static_students_razzle_rose',
    ]);
    const newAccent = result.palette.static_students_new_accent;
    const deprecatedRazzleRose = result.palette.static_students_razzle_rose;
    assert.ok(newAccent);
    assert.ok(deprecatedRazzleRose);
    assert.deepEqual(Object.keys(newAccent), [
        'rgba', 'hex', 'figma', 'web', 'alias',
    ]);
    assert.equal(deprecatedRazzleRose.deprecated, true);
    assert.equal(Object.keys(deprecatedRazzleRose).at(-1), 'deprecated');
});

test('новые модули останавливают экспорт при неизвестной секции или состоянии', () => {
    const wrongSection = makePage('colors_x5.json', [
        makeSection('light/brand', [makeFrame('primary', '#5faf2d')]),
    ]);
    const wrongState = makePage('colors_go.json', [
        makeSection('light/go', [
            {
                type: 'FRAME',
                name: 'lilac',
                children: [makeRectangle('#f6ebff', { name: 'hover' })],
            },
        ]),
    ]);

    assert.throws(
        () => parseFigmaPalette(makeFigmaFile([wrongSection]), x5),
        /недопустимое имя секции X5/,
    );
    assert.throws(
        () => parseFigmaPalette(makeFigmaFile([wrongState]), go),
        /неизвестное состояние light\/go\/lilac\/hover/,
    );
});

test('default-only набор игнорирует любое число empty вокруг настоящего состояния', () => {
    const page = makePage('colors_students.json', [
        makeSection('static_students', [{
            type: 'FRAME',
            name: 'electric-lime',
            children: [makeEmpty(), makeRectangle('#8fff00'), makeEmpty()],
        }]),
    ]);

    const parsed = parseFigmaPalette(makeFigmaFile([page]), students);
    assert.deepEqual([...parsed.tokens.keys()], ['static_students_electric_lime']);
    assert.deepEqual(parsed.counts, {
        sections: 1,
        frames: 1,
        rectangles: 3,
        placeholders: 2,
        tokens: 1,
    });
});
