import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^static_brand$/;

const definition = createDefaultOnlyPalette({
    id: 'brand',
    label: 'Brand',
    description: 'Статические фирменные цвета',
    pageName: 'colors_brand.json',
    sectionPattern: SECTION_NAME,
});

export const deriveBrandIdentity = definition.deriveIdentity;
export const makeBrandToken = definition.makeToken;
export default definition.palette;
