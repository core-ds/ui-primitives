// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=148173-9673
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=Flash20Icon / Flash24Icon / FlashLine20Icon / FlashLine24Icon / FlashThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('flash: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Default"]': { component: 'Flash20Icon', size: 20 },
    '["False","20","Line"]': { component: 'FlashLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'FlashThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'Flash24Icon', size: 24 },
    '["False","24","Line"]': { component: 'FlashLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('flash: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-148173-9673',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
