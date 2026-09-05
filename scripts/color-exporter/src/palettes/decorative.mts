import { invariant } from '../core/assertions.mjs';
import type {
    CanonicalColorToken,
    CanonicalTokenInput,
    IdentityContext,
    PaletteIdentity,
} from '../core/types.mjs';
import {
    DEFAULT_ONLY,
    INTERACTIVE_STATES,
    SIMPLE_FRAME_NAME,
    definePalette,
    deriveSectionIdentity,
    makeCanonicalColorToken,
    requireAllowedFrameStates,
    validateSectionNameContract,
} from './_shared.mjs';

const SECTION_NAME = /^(?:light|dark)\/decorative(?:-(?:soft|muted-alt|muted|text))?(?:_inverted)?$/;
const STATE_NAMES = INTERACTIVE_STATES;

/**
 * Decorative использует режим переменной Figma: сегмент до первого `/`
 * остаётся в JSON-ключе, но не попадает в Figma-путь. Дефисы в ключе
 * становятся подчёркиваниями.
 */
export function deriveDecorativeIdentity(context: IdentityContext): PaletteIdentity {
    return deriveSectionIdentity({
        ...context,
        sectionPattern: SECTION_NAME,
        stateNames: STATE_NAMES,
        paletteName: 'Decorative',
    });
}

export function makeDecorativeToken(context: CanonicalTokenInput): CanonicalColorToken {
    return makeCanonicalColorToken(context);
}

export default definePalette({
    id: 'decorative',
    description: 'Динамические декоративные цвета и их состояния',
    figma: {
        pageName: 'colors_decorative.json',
    },
    targetJson: 'styles/colors_decorative.json',
    stateNames: STATE_NAMES,

    validateSectionName(sectionName) {
        validateSectionNameContract({ sectionName, sectionPattern: SECTION_NAME, paletteName: 'Decorative' });
    },

    validateFrameName(frameName) {
        invariant(SIMPLE_FRAME_NAME.test(frameName), `недопустимое имя фрейма Decorative: ${frameName}`);
    },

    validateFrameComposition(context) {
        // У `decorative-text` нет состояний взаимодействия. `red` и `yellow`
        // также допускают только базовое значение. Остальные цвета могут
        // содержать любое непустое подмножество default, hover и press.
        const defaultOnly = context.sectionName.includes('decorative-text')
            || ['red', 'yellow'].includes(context.frameName);
        requireAllowedFrameStates(context, defaultOnly ? DEFAULT_ONLY : INTERACTIVE_STATES);
    },

    deriveIdentity: deriveDecorativeIdentity,
    makeToken: makeDecorativeToken,
});
