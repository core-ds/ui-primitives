// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=147615-40499
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=CrossCircle20Icon / CrossCircle24Icon / CrossCircleLine20Icon / CrossCircleLine24Icon / CrossCircleThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('cross-circle: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Default"]': { component: 'CrossCircle20Icon', size: 20 },
    '["False","20","Line"]': { component: 'CrossCircleLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'CrossCircleThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'CrossCircle24Icon', size: 24 },
    '["False","24","Line"]': { component: 'CrossCircleLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('cross-circle: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-147615-40499',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
