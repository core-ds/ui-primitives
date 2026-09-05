import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^static\/brand$/;

const definition = createDefaultOnlyPalette({
    id: 'x5',
    label: 'X5',
    description: 'Статические фирменные цвета X5',
    pageName: 'colors_x5.json',
    sectionPattern: SECTION_NAME,
    // У X5 имя секции совпадает с путём цветового стиля Figma и сохраняется целиком.
    sectionPathPolicy: 'literal',
});

export const deriveX5Identity = definition.deriveIdentity;
export const makeX5Token = definition.makeToken;
export default definition.palette;
