import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^(?:(?:light|dark)\/go|static_go)$/;

const definition = createDefaultOnlyPalette({
    id: 'go',
    label: 'Go',
    description: 'Динамические и статические цвета Go',
    pageName: 'colors_go.json',
    sectionPattern: SECTION_NAME,
});

export const deriveGoIdentity = definition.deriveIdentity;
export const makeGoToken = definition.makeToken;
export default definition.palette;
