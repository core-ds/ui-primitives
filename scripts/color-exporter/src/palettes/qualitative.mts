import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^(?:light|dark)\/qualitative-(?:flexible|monocolor|(?:duocolor|tricolor|tetracolor)\/set-[a-z0-9-]+)$/;

const definition = createDefaultOnlyPalette({
    id: 'qualitative',
    label: 'Qualitative',
    description: 'Категориальные цвета диаграмм Light и Dark',
    pageName: 'colors_qualitative.json',
    sectionPattern: SECTION_NAME,
});

export const deriveQualitativeIdentity = definition.deriveIdentity;
export const makeQualitativeToken = definition.makeToken;
export default definition.palette;
