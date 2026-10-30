// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=137770-9033
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph/src
// component=ResizeUpLeftMIcon / ResizeUpLeftSIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { m: 'm', s: 's', xxl: 'xxl' })];
if (state.some((value) => value === undefined)) {
    throw new Error('resize-up-left: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["m"]': { component: 'ResizeUpLeftMIcon', size: 24 },
    '["s"]': { component: 'ResizeUpLeftSIcon', size: 16 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('resize-up-left: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-137770-9033',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
