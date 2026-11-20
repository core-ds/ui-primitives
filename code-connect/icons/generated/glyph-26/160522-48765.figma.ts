// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=160522-48765
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph-26/src
// component=ActionAlfa32ColorIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [
    instance.getEnum('Color', { True: 'True' }),
    instance.getEnum('Default', { Line: 'Line' }),
    instance.getEnum('Size', { '32': '32' }),
];
if (state.some((value) => value === undefined)) {
    throw new Error('action-alfa: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["True","Line","32"]': { component: 'ActionAlfa32ColorIcon', size: 32 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('action-alfa: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph-26/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-26-160522-48765',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
