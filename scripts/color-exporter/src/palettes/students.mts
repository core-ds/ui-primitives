import { createDefaultOnlyPalette } from './_create-default-only.mjs';

const SECTION_NAME = /^static_students$/;

const definition = createDefaultOnlyPalette({
    id: 'students',
    label: 'Students',
    description: 'Статические акцентные цвета Alfa Future',
    pageName: 'colors_students.json',
    sectionPattern: SECTION_NAME,
});

export const deriveStudentsIdentity = definition.deriveIdentity;
export const makeStudentsToken = definition.makeToken;
export default definition.palette;
