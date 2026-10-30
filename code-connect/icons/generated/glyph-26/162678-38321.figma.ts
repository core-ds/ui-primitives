// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=162678-38321
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=NavigationClockLine24Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '24': '24' }),
    instance.getEnum('Style', { Line: 'Line' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('navigation-clock: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","24","Line"]': { component: 'NavigationClockLine24Icon', size: 24 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('navigation-clock: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-162678-38321',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
