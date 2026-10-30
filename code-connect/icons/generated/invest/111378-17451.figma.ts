// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=111378-17451
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/invest/src
// component=LineBubbleMIcon / LineBubbleSIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { m: 'm', s: 's', xxl: 'xxl' })];
if (state.some((value) => value === undefined)) {
    throw new Error('line-bubble: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["m"]': { component: 'LineBubbleMIcon', size: 24 },
    '["s"]': { component: 'LineBubbleSIcon', size: 16 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('line-bubble: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-invest/${component}';`];

export default {
    id: 'ui-primitives-icon-invest-111378-17451',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
