import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^(?:(?:light|dark)\/monochrome-(?:black|white)(?:_inverted)?|static_monochrome-(?:black|white))$/;
const FRAME_NAME = /^[0-9]+$/;

const definition = createDefaultOnlyPalette({
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Полупрозрачные чёрные и белые цвета',
    pageName: 'colors_monochrome.json',
    sectionPattern: SECTION_NAME,
    frameNamePattern: FRAME_NAME,
    frameNameError: (frameName) => `фрейм Monochrome должен быть целым процентом: ${frameName}`,
});

export const deriveMonochromeIdentity = definition.deriveIdentity;
export const makeMonochromeToken = definition.makeToken;
export default definition.palette;
