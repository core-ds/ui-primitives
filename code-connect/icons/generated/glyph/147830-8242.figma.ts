// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=147830-8242
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph/src
// component=ABookLIcon / ABookMIcon / ABookSIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { l: 'l', m: 'm', s: 's' })];
if (state.some((value) => value === undefined)) {
    throw new Error('a-book: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["l"]': { component: 'ABookLIcon', size: 48 },
    '["m"]': { component: 'ABookMIcon', size: 24 },
    '["s"]': { component: 'ABookSIcon', size: 16 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('a-book: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-147830-8242',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
