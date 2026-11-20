// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=126156-10409
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph/src
// component=HeatMIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { m: 'm', s: 's', xxl: 'xxl' })];
if (state.some((value) => value === undefined)) {
    throw new Error('heat: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = { '["m"]': { component: 'HeatMIcon', size: 24 } };
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('heat: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-126156-10409',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
