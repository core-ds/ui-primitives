import { invariant } from '../core/assertions.mjs';
import type {
    CanonicalTokenInput,
    IdentityContext,
    PaletteDefinition,
} from '../core/types.mjs';
import {
    INTERACTIVE_STATES,
    SIMPLE_FRAME_NAME,
    definePalette,
    deriveSectionIdentity,
    makeCanonicalColorToken,
    validateStandardFrameComposition,
    validateSectionNameContract,
} from './_shared.mjs';

const PAGE_NAME = /^colors_([a-z0-9_]+)\.json$/;
const SECTION_NAME = /^(?:(?:light|dark)\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*|static_[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)$/;

export interface StandardPalettePage {
    pageName: string;
}

/**
 * Создаёт исполняемые правила для новой стандартной страницы Figma.
 * Исходный модуль на диск не записывается: отдельный файл нужен только тогда,
 * когда набор отклоняется от общего контракта.
 */
export function createStandardPaletteForPage({
    pageName,
}: StandardPalettePage): Readonly<PaletteDefinition> {
    const match = PAGE_NAME.exec(pageName);
    invariant(match !== null, `недопустимое имя стандартной страницы ${String(pageName)}`);
    const machineName = match[1];
    invariant(machineName !== undefined && machineName.length > 0, `не удалось определить имя набора ${pageName}`);
    const id = machineName.replaceAll('_', '-');
    const paletteName = `стандартная палитра ${pageName}`;

    return definePalette({
        id,
        description: `Стандартные правила страницы ${pageName}`,
        figma: { pageName },
        targetJson: `styles/${pageName}`,
        stateNames: INTERACTIVE_STATES,

        validateSectionName(sectionName) {
            validateSectionNameContract({ sectionName, sectionPattern: SECTION_NAME, paletteName });
        },

        validateFrameName(frameName) {
            invariant(SIMPLE_FRAME_NAME.test(frameName), `недопустимое имя фрейма ${paletteName}: ${frameName}`);
        },

        validateFrameComposition: validateStandardFrameComposition,

        deriveIdentity(context: IdentityContext) {
            return deriveSectionIdentity({
                ...context,
                sectionPattern: SECTION_NAME,
                stateNames: INTERACTIVE_STATES,
                paletteName,
            });
        },

        makeToken(context: CanonicalTokenInput) {
            return makeCanonicalColorToken(context);
        },
    });
}
