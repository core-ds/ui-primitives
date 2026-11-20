// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=149085-17078
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ChevronLeft24Icon / ChevronLeftLine20Icon / ChevronLeftLine24Icon / ChevronLeftThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('chevron-left: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Line"]': { component: 'ChevronLeftLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'ChevronLeftThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'ChevronLeft24Icon', size: 24 },
    '["False","24","Line"]': { component: 'ChevronLeftLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('chevron-left: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-149085-17078',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
