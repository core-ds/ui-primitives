import assert from 'node:assert/strict';
import test from 'node:test';

import brand, { deriveBrandIdentity } from '../src/palettes/brand.mjs';
import decorative, { deriveDecorativeIdentity } from '../src/palettes/decorative.mjs';
import go, { deriveGoIdentity } from '../src/palettes/go.mjs';
import monochrome, { deriveMonochromeIdentity } from '../src/palettes/monochrome.mjs';
import promo, { derivePromoIdentity } from '../src/palettes/promo.mjs';
import qualitative, {
    deriveQualitativeIdentity,
    makeQualitativeToken,
} from '../src/palettes/qualitative.mjs';
import sequential, { deriveSequentialIdentity } from '../src/palettes/sequential.mjs';
import students, { deriveStudentsIdentity } from '../src/palettes/students.mjs';
import x5, { deriveX5Identity } from '../src/palettes/x5.mjs';

test('каждая палитра предсказуемо строит ключ и Figma-путь', () => {
    const examples = [
        {
            derive: deriveDecorativeIdentity,
            input: { sectionName: 'dark/decorative-soft_inverted', frameName: 'green', stateName: 'press' },
            expected: {
                key: 'dark_decorative_soft_green_inverted_press',
                figma: 'decorative-soft_inverted/green/press',
                mode: 'dark',
            },
        },
        {
            derive: deriveQualitativeIdentity,
            input: { sectionName: 'light/qualitative-duocolor/set-a', frameName: '1', stateName: 'default' },
            expected: {
                key: 'light_qualitative_duocolor_set_a_1',
                figma: 'qualitative-duocolor/set-a/1',
                mode: 'light',
            },
        },
        {
            derive: deriveSequentialIdentity,
            input: { sectionName: 'dark/sequential-blue', frameName: '8', stateName: 'default' },
            expected: {
                key: 'dark_sequential_blue_8',
                figma: 'sequential-blue/8',
                mode: 'dark',
            },
        },
        {
            derive: derivePromoIdentity,
            input: { sectionName: 'light/promo-vibrant', frameName: 'tomato', stateName: 'hover' },
            expected: {
                key: 'light_promo_vibrant_tomato_hover',
                figma: 'promo-vibrant/tomato/hover',
                mode: 'light',
            },
        },
        {
            derive: deriveBrandIdentity,
            input: { sectionName: 'static_brand', frameName: 'bright-blue', stateName: 'default' },
            expected: {
                key: 'static_brand_bright_blue',
                figma: 'static_brand/bright-blue',
                mode: 'static',
            },
        },
        {
            derive: deriveMonochromeIdentity,
            input: { sectionName: 'dark/monochrome-white_inverted', frameName: '88', stateName: 'default' },
            expected: {
                key: 'dark_monochrome_white_88_inverted',
                figma: 'monochrome-white_inverted/88',
                mode: 'dark',
            },
        },
        {
            derive: deriveStudentsIdentity,
            input: { sectionName: 'static_students', frameName: 'electric-lime', stateName: 'default' },
            expected: {
                key: 'static_students_electric_lime',
                figma: 'static_students/electric-lime',
                mode: 'static',
            },
        },
        {
            derive: deriveGoIdentity,
            input: { sectionName: 'dark/go', frameName: 'lilac', stateName: 'default' },
            expected: {
                key: 'dark_go_lilac',
                figma: 'go/lilac',
                mode: 'dark',
            },
        },
        {
            derive: deriveX5Identity,
            input: { sectionName: 'static/brand', frameName: 'secondary', stateName: 'default' },
            expected: {
                key: 'static_brand_secondary',
                figma: 'static/brand/secondary',
                mode: 'static',
            },
        },
    ];

    for (const example of examples) {
        assert.deepEqual(example.derive(example.input), example.expected);
    }
});

test('новое допустимое имя фрейма проходит ту же формулу без отдельного списка', () => {
    assert.deepEqual(
        deriveSequentialIdentity({
            sectionName: 'light/sequential-blue',
            frameName: 'new-step',
            stateName: 'default',
        }),
        {
            key: 'light_sequential_blue_new_step',
            figma: 'sequential-blue/new-step',
            mode: 'light',
        },
    );
});

test('общая формула создаёт пять полей и ставит Color перед именем токена', () => {
    const token = makeQualitativeToken({
        identity: {
            key: 'light_qualitative_duocolor_set_a_1',
            figma: 'qualitative-duocolor/set-a/1',
            mode: 'light',
        },
        color: {
            rgba: 'rgba(12, 196, 77, 1)',
            hex: '#0cc44d',
        },
        stateName: 'default',
    });

    assert.deepEqual(token, {
        rgba: 'rgba(12, 196, 77, 1)',
        hex: '#0cc44d',
        figma: 'qualitative-duocolor/set-a/1',
        web: '--color-light-qualitative-duocolor-set-a-1',
        alias: 'qualitativeDuocolorSetAColor1',
    });
    assert.deepEqual(Object.keys(token), ['rgba', 'hex', 'figma', 'web', 'alias']);
});

test('Decorative допускает подмножество состояний и сохраняет default-only ограничения', () => {
    assert.doesNotThrow(() => decorative.validateFrameComposition({
        sectionName: 'light/decorative',
        frameName: 'red',
        stateNames: ['default'],
    }));
    assert.doesNotThrow(() => decorative.validateFrameComposition({
        sectionName: 'dark/decorative-text_inverted',
        frameName: 'blue',
        stateNames: ['default'],
    }));
    assert.doesNotThrow(() => decorative.validateFrameComposition({
        sectionName: 'light/decorative-soft',
        frameName: 'blue',
        stateNames: ['hover', 'press'],
    }));
    assert.throws(() => decorative.validateFrameComposition({
        sectionName: 'light/decorative-soft',
        frameName: 'red',
        stateNames: ['hover'],
    }), /допускает состояния default/);
});

test('Promo различает динамические состояния и статическое значение', () => {
    assert.doesNotThrow(() => promo.validateFrameComposition({
        sectionName: 'dark/promo-pale',
        frameName: 'lagoon',
        stateNames: ['default', 'hover', 'press'],
    }));
    assert.doesNotThrow(() => promo.validateFrameComposition({
        sectionName: 'dark/promo-pale',
        frameName: 'lagoon',
        stateNames: ['hover'],
    }));
    assert.doesNotThrow(() => promo.validateFrameComposition({
        sectionName: 'static_promo',
        frameName: 'classic',
        stateNames: ['default'],
    }));
});

test('наборы без состояний требуют единственное настоящее состояние default', () => {
    for (const palette of [qualitative, sequential, brand, monochrome, students, go, x5]) {
        assert.doesNotThrow(() => palette.validateFrameComposition({
            sectionName: palette.id,
            frameName: 'example',
            stateNames: ['default'],
        }));
        assert.throws(() => palette.validateFrameComposition({
            sectionName: palette.id,
            frameName: 'example',
            stateNames: [],
        }), /не содержит ни одного цветового состояния/);
    }
});

test('Students, Go и X5 принимают новые допустимые имена без ручного списка токенов', () => {
    assert.deepEqual(
        deriveStudentsIdentity({
            sectionName: 'static_students',
            frameName: 'new-accent',
            stateName: 'default',
        }),
        {
            key: 'static_students_new_accent',
            figma: 'static_students/new-accent',
            mode: 'static',
        },
    );
    assert.deepEqual(
        deriveGoIdentity({
            sectionName: 'light/go',
            frameName: 'new-accent',
            stateName: 'default',
        }),
        {
            key: 'light_go_new_accent',
            figma: 'go/new-accent',
            mode: 'light',
        },
    );
    assert.deepEqual(
        deriveX5Identity({
            sectionName: 'static/brand',
            frameName: 'new-accent',
            stateName: 'default',
        }),
        {
            key: 'static_brand_new_accent',
            figma: 'static/brand/new-accent',
            mode: 'static',
        },
    );
});

test('X5 использует общий алфавитный порядок активных токенов', () => {
    assert.equal(Object.hasOwn(x5, 'compareActiveKeys'), false);
});

test('Monochrome использует общий алфавитный порядок активных токенов', () => {
    assert.equal(Object.hasOwn(monochrome, 'compareActiveKeys'), false);
});

test('Monochrome отклоняет дробное значение процента', () => {
    assert.throws(
        () => monochrome.validateFrameName('10.5'),
        /фрейм Monochrome должен быть целым процентом: 10\.5/,
    );
});
