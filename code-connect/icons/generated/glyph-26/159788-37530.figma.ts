// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=159788-37530
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ActionClock32Icon / ActionClockLine32Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '32': '32' }),
    instance.getEnum('Style', { Default: 'Default', Line: 'Line' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('action-clock: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","32","Default"]': { component: 'ActionClock32Icon', size: 32 },
    '["False","32","Line"]': { component: 'ActionClockLine32Icon', size: 32 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('action-clock: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-159788-37530',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
