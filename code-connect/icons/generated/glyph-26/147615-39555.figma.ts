// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=147615-39555
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=Calendar20Icon / Calendar24Icon / CalendarLine20Icon / CalendarLine24Icon / CalendarThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('calendar: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Default"]': { component: 'Calendar20Icon', size: 20 },
    '["False","20","Line"]': { component: 'CalendarLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'CalendarThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'Calendar24Icon', size: 24 },
    '["False","24","Line"]': { component: 'CalendarLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('calendar: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-147615-39555',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
