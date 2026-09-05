import { invariant } from '../core/assertions.mjs';
import type {
    CanonicalColorToken,
    CanonicalTokenInput,
    IdentityContext,
    PaletteIdentity,
} from '../core/types.mjs';
import {
    INTERACTIVE_STATES,
    SIMPLE_FRAME_NAME,
    definePalette,
    deriveSectionIdentity,
    makeAliasFromFigmaPath,
    makeCanonicalColorToken,
    validateSectionNameContract,
    validateStandardFrameComposition,
} from './_shared.mjs';

const SECTION_NAME = /^(?:(?:light|dark)\/[a-z0-9_-]+|static_[a-z0-9_-]+)(?:_inverted)?$/;
const STATE_NAMES = INTERACTIVE_STATES;

/**
 * Строит машинный ключ JSON и путь из поля `figma`.
 *
 * В динамических темах `light`/`dark` заданы режимом переменной и отделены
 * слешем: `light/accent` даёт ключ `light_accent_primary`, но путь
 * `accent/primary`. В `static_accent` режим токена записан в имени
 * переменной, поэтому сохраняется и в ключе, и в поле `figma`.
 */
export function deriveBluetintIdentity({ sectionName, frameName, stateName }: IdentityContext): PaletteIdentity {
    return deriveSectionIdentity({
        sectionName,
        frameName,
        stateName,
        sectionPattern: SECTION_NAME,
        stateNames: STATE_NAMES,
        paletteName: 'BlueTint',
    });
}

/**
 * Строит поле `alias` из пути Figma.
 *
 * Пример: accent_inverted/primary/hover превращается в
 * accentColorPrimaryInvertedHover. Формула проверена на всех 692 токенах
 * текущей раскладки BlueTint.
 */
export function makeBluetintAlias(figmaPath: string, stateName: string): string {
    return makeAliasFromFigmaPath(figmaPath, stateName);
}

/**
 * Полностью создаёт объект токена. Старый JSON здесь не используется:
 * все пять полей воспроизводятся из Figma и правил BlueTint при каждом
 * запуске, поэтому ручные расхождения автоматически исчезают.
 */
export function makeBluetintToken({ identity, color, stateName }: CanonicalTokenInput): CanonicalColorToken {
    return makeCanonicalColorToken({ identity, color, stateName });
}

/**
 * Отдельный модуль фиксирует исторически проверенный контракт BlueTint.
 * Новая стандартная страница в общем Color Exporter отдельного модуля не
 * требует. Модуль нужен только для осознанного отклонения от общих правил.
 */
export default definePalette({
    id: 'bluetint',
    description: 'Основная динамическая и статическая палитра BlueTint',
    figma: {
        pageName: 'colors_bluetint.json',
    },
    targetJson: 'styles/colors_bluetint.json',
    stateNames: STATE_NAMES,

    validateSectionName(sectionName) {
        validateSectionNameContract({ sectionName, sectionPattern: SECTION_NAME, paletteName: 'BlueTint' });
    },

    validateFrameName(frameName) {
        invariant(SIMPLE_FRAME_NAME.test(frameName), `недопустимое имя фрейма BlueTint: ${frameName}`);
    },

    validateFrameComposition: validateStandardFrameComposition,

    deriveIdentity: deriveBluetintIdentity,
    makeToken: makeBluetintToken,
});
