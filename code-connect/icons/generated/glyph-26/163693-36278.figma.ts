// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=163693-36278
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ActionArrowsRightLeftLine32Icon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { False: 'False' }),
    instance.getEnum('Size', { '32': '32' }),
    instance.getEnum('Style', { Line: 'Line' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('action-arrows-right-left: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["False","32","Line"]': { component: 'ActionArrowsRightLeftLine32Icon', size: 32 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('action-arrows-right-left: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-163693-36278',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
