// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=92252-24260
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/ios/src
// component=EurMIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { m: 'm', s: 's', xxl: 'xxl' })];
if (state.some((value) => value === undefined)) {
    throw new Error('eur: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = { '["m"]': { component: 'EurMIcon', size: 24 } };
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('eur: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-ios/${component}';`];

export default {
    id: 'ui-primitives-icon-ios-92252-24260',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
