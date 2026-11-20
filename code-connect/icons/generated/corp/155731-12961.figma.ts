// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=155731-12961
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/corp/src
// component=NeuralAssistantFlareMIcon / NeuralAssistantFlareSIcon / NeuralAssistantFlareXxlIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { m: 'm', s: 's', xxl: 'xxl' })];
if (state.some((value) => value === undefined)) {
    throw new Error('neural-assistant-flare: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["m"]': { component: 'NeuralAssistantFlareMIcon', size: 24 },
    '["s"]': { component: 'NeuralAssistantFlareSIcon', size: 16 },
    '["xxl"]': { component: 'NeuralAssistantFlareXxlIcon', size: 48 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('neural-assistant-flare: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-corp/${component}';`];

export default {
    id: 'ui-primitives-icon-corp-155731-12961',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
