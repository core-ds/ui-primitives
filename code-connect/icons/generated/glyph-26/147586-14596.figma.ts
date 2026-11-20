// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=147586-14596
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ChartLineUnderlineRectangleLine20Icon / ChartLineUnderlineRectangleLine24Icon / ChartLineUnderlineRectangleThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('chart-line-underline-rectangle: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Line"]': { component: 'ChartLineUnderlineRectangleLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'ChartLineUnderlineRectangleThinline20Icon', size: 20 },
    '["False","24","Line"]': { component: 'ChartLineUnderlineRectangleLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('chart-line-underline-rectangle: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-147586-14596',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
