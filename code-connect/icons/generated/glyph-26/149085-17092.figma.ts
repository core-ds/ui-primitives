// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=149085-17092
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ChevronLeftShiftUpChevronRightShiftDown20Icon / ChevronLeftShiftUpChevronRightShiftDown24Icon / ChevronLeftShiftUpChevronRightShiftDownLine20Icon / ChevronLeftShiftUpChevronRightShiftDownLine24Icon / ChevronLeftShiftUpChevronRightShiftDownThinline20Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '20': '20', '24': '24' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line', Thinline: 'Thinline' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('chevron-left-shift-up-chevron-right-shift-down: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","20","Default"]': { component: 'ChevronLeftShiftUpChevronRightShiftDown20Icon', size: 20 },
    '["False","20","Line"]': { component: 'ChevronLeftShiftUpChevronRightShiftDownLine20Icon', size: 20 },
    '["False","20","Thinline"]': { component: 'ChevronLeftShiftUpChevronRightShiftDownThinline20Icon', size: 20 },
    '["False","24","Default"]': { component: 'ChevronLeftShiftUpChevronRightShiftDown24Icon', size: 24 },
    '["False","24","Line"]': { component: 'ChevronLeftShiftUpChevronRightShiftDownLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error(
        'chevron-left-shift-up-chevron-right-shift-down: точное соответствие выбранного варианта не подтверждено'
    );
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-149085-17092',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
