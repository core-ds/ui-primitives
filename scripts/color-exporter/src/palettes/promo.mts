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

const SECTION_NAME = /^(?:(?:light|dark)\/promo(?:-(?:muted|pale|vibrant))?|static_promo)$/;
const STATE_NAMES = INTERACTIVE_STATES;

export function derivePromoIdentity(context: IdentityContext): PaletteIdentity {
    return deriveSectionIdentity({
        ...context,
        sectionPattern: SECTION_NAME,
        stateNames: STATE_NAMES,
        paletteName: 'Promo',
    });
}

export function makePromoToken(context: CanonicalTokenInput): CanonicalColorToken {
    return makeCanonicalColorToken(context);
}

export default definePalette({
    id: 'promo',
    description: 'Промо-цвета, состояния и опубликованный static_promo',
    figma: {
        pageName: 'colors_promo.json',
    },
    targetJson: 'styles/colors_promo.json',
    stateNames: STATE_NAMES,

    validateSectionName(sectionName) {
        validateSectionNameContract({ sectionName, sectionPattern: SECTION_NAME, paletteName: 'Promo' });
    },

    validateFrameName(frameName) {
        invariant(SIMPLE_FRAME_NAME.test(frameName), `недопустимое имя фрейма Promo: ${frameName}`);
    },

    validateFrameComposition(context) {
        const expectedStates = context.sectionName === 'static_promo'
            ? DEFAULT_ONLY
            : INTERACTIVE_STATES;
        requireAllowedFrameStates(context, expectedStates);
    },

    deriveIdentity: derivePromoIdentity,
    makeToken: makePromoToken,
});
