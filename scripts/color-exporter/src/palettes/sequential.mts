import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^(?:light|dark)\/sequential-[a-z0-9-]+$/;

const definition = createDefaultOnlyPalette({
    id: 'sequential',
    label: 'Sequential',
    description: 'Последовательные шкалы диаграмм Light и Dark',
    pageName: 'colors_sequential.json',
    sectionPattern: SECTION_NAME,
});

export const deriveSequentialIdentity = definition.deriveIdentity;
export const makeSequentialToken = definition.makeToken;
export default definition.palette;
