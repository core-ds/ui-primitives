import { invariant } from '../core/assertions.mjs';
import {
    DEFAULT_ONLY,
    SIMPLE_FRAME_NAME,
    definePalette,
    deriveSectionIdentity,
    makeCanonicalColorToken,
    requireAllowedFrameStates,
    validateSectionNameContract,
} from './_shared.mjs';
import type { SectionPathPolicy } from './_shared.mjs';
import type {
    CanonicalColorToken,
    CanonicalTokenInput,
    IdentityContext,
    PaletteDefinition,
    PaletteIdentity,
} from '../core/types.mjs';

export interface DefaultOnlyPaletteOptions {
    id: string;
    label: string;
    description: string;
    pageName: string;
    sectionPattern: RegExp;
    frameNamePattern?: RegExp;
    frameNameError?: (frameName: string) => string;
    sectionPathPolicy?: SectionPathPolicy;
}

export interface DefaultOnlyPaletteDefinition {
    palette: Readonly<PaletteDefinition>;
    deriveIdentity(context: IdentityContext): PaletteIdentity;
    makeToken(context: CanonicalTokenInput): CanonicalColorToken;
}

/**
 * Создаёт модуль палитры, в которой единственным настоящим состоянием может
 * быть `default`. Любое число `empty` парсер заранее безусловно игнорирует.
 *
 * Фабрика убирает повторяющуюся служебную обвязку, но не прячет правила
 * набора: допустимые секции, имена фреймов и трактовка режима в Figma-пути
 * по-прежнему объявлены в отдельном файле каждой палитры.
 */
export function createDefaultOnlyPalette({
    id,
    label,
    description,
    pageName,
    sectionPattern,
    frameNamePattern = SIMPLE_FRAME_NAME,
    frameNameError,
    sectionPathPolicy = 'standard',
}: DefaultOnlyPaletteOptions): Readonly<DefaultOnlyPaletteDefinition> {
    invariant(/^[a-z0-9-]+$/.test(id ?? ''), 'фабрике палитры нужен стабильный id');
    invariant(typeof label === 'string' && label.length > 0, `${id}: label обязателен`);
    invariant(typeof description === 'string' && description.length > 0, `${id}: description обязателен`);
    invariant(/^colors_[a-z0-9_]+\.json$/.test(pageName ?? ''), `${id}: недопустимое имя страницы ${String(pageName)}`);
    invariant(sectionPattern instanceof RegExp, `${label}: sectionPattern должен быть регулярным выражением`);
    invariant(!sectionPattern.global && !sectionPattern.sticky, `${label}: sectionPattern не должен хранить состояние`);
    invariant(frameNamePattern instanceof RegExp, `${label}: frameNamePattern должен быть регулярным выражением`);
    invariant(!frameNamePattern.global && !frameNamePattern.sticky, `${label}: frameNamePattern не должен хранить состояние`);
    invariant(frameNameError === undefined || typeof frameNameError === 'function', `${label}: frameNameError должен быть функцией`);
    invariant(
        sectionPathPolicy === 'standard' || sectionPathPolicy === 'literal',
        `${label}: неизвестная политика пути секции`,
    );

    function deriveIdentity(context: IdentityContext): PaletteIdentity {
        return deriveSectionIdentity({
            ...context,
            sectionPattern,
            frameNamePattern,
            stateNames: DEFAULT_ONLY,
            paletteName: label,
            sectionPathPolicy,
        });
    }

    function makeToken(context: CanonicalTokenInput): CanonicalColorToken {
        return makeCanonicalColorToken(context);
    }

    const palette = definePalette({
        id,
        description,
        figma: { pageName },
        targetJson: `styles/${pageName}`,
        stateNames: DEFAULT_ONLY,

        validateSectionName(sectionName) {
            validateSectionNameContract({ sectionName, sectionPattern, paletteName: label, sectionPathPolicy });
        },

        validateFrameName(frameName) {
            if (!frameNamePattern.test(frameName)) {
                invariant(false, frameNameError?.(frameName) ?? `недопустимое имя фрейма ${label}: ${frameName}`);
            }
        },

        validateFrameComposition(context) {
            requireAllowedFrameStates(context, DEFAULT_ONLY);
        },

        deriveIdentity,
        makeToken,
    });

    return Object.freeze({
        palette,
        deriveIdentity,
        makeToken,
    });
}
