// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=147586-14463
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=SquareAcademicCap24Icon / SquareAcademicCapLine20Icon / SquareAcademicCapLine24Icon / SquareAcademicCapThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('square-academic-cap: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Line"]': { component: 'SquareAcademicCapLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'SquareAcademicCapThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'SquareAcademicCap24Icon', size: 24 },
    '["False","24","Line"]': { component: 'SquareAcademicCapLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('square-academic-cap: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-147586-14463',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
