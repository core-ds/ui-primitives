import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultOnlyPalette } from '../src/palettes/_create-default-only.mjs';
import { createStandardPaletteForPage } from '../src/palettes/_create-standard.mjs';
import { makeAliasFromFigmaPath } from '../src/palettes/_shared.mjs';

function createExample(overrides = {}) {
    return createDefaultOnlyPalette({
        id: 'example',
        label: 'Example',
        description: 'Учебная палитра',
        pageName: 'colors_example.json',
        sectionPattern: /^static_example$/,
        ...overrides,
    });
}

test('фабрика создаёт законченный модуль палитры без ручного реестра', () => {
    const definition = createExample();

    assert.equal(definition.palette.id, 'example');
    assert.equal(definition.palette.targetJson, 'styles/colors_example.json');
    assert.equal(definition.palette.figma.pageName, 'colors_example.json');
    assert.deepEqual(definition.palette.stateNames, ['default']);
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.palette), true);
    assert.equal(Object.isFrozen(definition.palette.figma), true);
});

test('новое допустимое имя фрейма сразу проходит общую формулу', () => {
    const { deriveIdentity } = createExample();

    assert.deepEqual(deriveIdentity({
        sectionName: 'static_example',
        frameName: 'brand-new-42',
        stateName: 'default',
    }), {
        key: 'static_example_brand_new_42',
        figma: 'static_example/brand-new-42',
        mode: 'static',
    });
});

test('особый шаблон фрейма одинаково действует в проверке и в формуле', () => {
    const definition = createExample({
        frameNamePattern: /^[0-9]+$/,
        frameNameError: (frameName: string) => `ожидалось число: ${frameName}`,
    });

    assert.doesNotThrow(() => definition.palette.validateFrameName('42'));
    assert.throws(() => definition.palette.validateFrameName('blue'), /ожидалось число: blue/);
    assert.throws(() => definition.deriveIdentity({
        sectionName: 'static_example',
        frameName: 'blue',
        stateName: 'default',
    }), /недопустимое имя фрейма Example/);
});

test('фабрика отклоняет регулярное выражение со скрытым состоянием', () => {
    assert.throws(
        () => createExample({ sectionPattern: /^static_example$/g }),
        /sectionPattern не должен хранить состояние/,
    );
});

test('стандартная страница предсказуемо определяет id, путь и поля токена', () => {
    const palette = createStandardPaletteForPage({
        pageName: 'colors_new_palette.json',
    });
    const identity = palette.deriveIdentity({
        sectionName: 'dark/accent_inverted',
        frameName: 'primary',
        stateName: 'hover',
    });
    const token = palette.makeToken({
        identity,
        color: { rgba: 'rgba(239, 49, 36, 1)', hex: '#ef3124' },
        sectionName: 'dark/accent_inverted',
        frameName: 'primary',
        stateName: 'hover',
    });

    assert.equal(palette.id, 'new-palette');
    assert.equal(palette.targetJson, 'styles/colors_new_palette.json');
    assert.deepEqual(identity, {
        key: 'dark_accent_primary_inverted_hover',
        figma: 'accent_inverted/primary/hover',
        mode: 'dark',
    });
    assert.deepEqual(token, {
        rgba: 'rgba(239, 49, 36, 1)',
        hex: '#ef3124',
        figma: 'accent_inverted/primary/hover',
        web: '--color-dark-accent-primary-inverted-hover',
        alias: 'accentColorPrimaryInvertedHover',
    });
});

test('стандартная страница различает режим переменной и режим токена', () => {
    const palette = createStandardPaletteForPage({ pageName: 'colors_new_palette.json' });

    assert.deepEqual(palette.deriveIdentity({
        sectionName: 'light/qualitative-duocolor/set-c',
        frameName: '1',
        stateName: 'default',
    }), {
        key: 'light_qualitative_duocolor_set_c_1',
        figma: 'qualitative-duocolor/set-c/1',
        mode: 'light',
    });
    assert.deepEqual(palette.deriveIdentity({
        sectionName: 'static_accent',
        frameName: 'primary',
        stateName: 'default',
    }), {
        key: 'static_accent_primary',
        figma: 'static_accent/primary',
        mode: 'static',
    });
});

test('стандартная страница принимает только актуальные формы режимов', () => {
    const palette = createStandardPaletteForPage({ pageName: 'colors_new_palette.json' });

    for (const sectionName of [
        'light/accent',
        'dark/qualitative-duocolor/set-c',
        'static_accent',
    ]) {
        assert.doesNotThrow(() => palette.validateSectionName(sectionName));
    }

    for (const sectionName of [
        'static/accent',
        'light_accent',
        'dark_accent',
    ]) {
        assert.throws(() => palette.validateSectionName(sectionName), /недопустимое имя секции/);
    }

    for (const sectionName of ['light/static_accent', 'dark/static_accent']) {
        assert.throws(
            () => palette.validateSectionName(sectionName),
            /режим переменной и режим токена/,
        );
    }
    for (const sectionName of ['dark/light_accent', 'light/dark_accent']) {
        assert.throws(
            () => palette.validateSectionName(sectionName),
            /не должен начинаться с light_ или dark_/,
        );
    }
});

test('общий разборщик отклоняет недопустимые формы даже при широком правиле набора', () => {
    const definition = createExample({ sectionPattern: /^[a-z0-9_/-]+$/ });

    for (const sectionName of ['static/accent', 'light_accent', 'dark_accent']) {
        assert.throws(
            () => definition.palette.validateSectionName(sectionName),
            /должна иметь вид light\/<путь>, dark\/<путь> или static_<путь>/,
        );
    }

    assert.throws(
        () => definition.palette.validateSectionName('light/static_accent'),
        /режим переменной и режим токена/,
    );
});

test('стандартная фабрика требует машинное имя страницы', () => {
    assert.throws(() => createStandardPaletteForPage({
        pageName: 'Example',
    }), /недопустимое имя стандартной страницы/);
});

test('формула alias требует известное состояние и не угадывает его по имени фрейма', () => {
    assert.equal(makeAliasFromFigmaPath('accent/hover', 'default'), 'accentColorHover');
    assert.equal(makeAliasFromFigmaPath('accent/press', 'default'), 'accentColorPress');
    assert.throws(
        () => Reflect.apply(makeAliasFromFigmaPath, undefined, ['accent/primary/hover']),
        /состояние.*обязательно/,
    );
});
