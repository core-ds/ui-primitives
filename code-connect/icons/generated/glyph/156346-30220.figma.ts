// url=https://www.figma.com/design/ZcdUPebEhHfSZ91zgmv2cK/Icons?node-id=156346-30220
// source=https://github.com/core-ds/ui-primitives/tree/master/packages/glyph/src
// component=ABookSIcon / IncognitoLIcon / IncognitoMIcon
// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.
import figma from 'figma';

const instance = figma.selectedInstance;
const state: Array<string | undefined> = [instance.getEnum('Size', { l: 'l', m: 'm', s: 's' })];
if (state.some((value) => value === undefined)) {
    throw new Error('incognito: неизвестные или отсутствующие свойства Figma');
}
const variants: Record<string, { component: string; size: number }> = {
    '["l"]': { component: 'IncognitoLIcon', size: 48 },
    '["m"]': { component: 'IncognitoMIcon', size: 24 },
    '["s"]': { component: 'ABookSIcon', size: 16 },
};
const selected = variants[JSON.stringify(state)];
if (!selected) {
    throw new Error('incognito: точное соответствие выбранного варианта не подтверждено');
}
const component = selected.component;
const imports = [`import { ${component} } from '@alfalab/icons-glyph/${component}';`];

export default {
    id: 'ui-primitives-icon-glyph-156346-30220',
    imports,
    example: figma.code`<${component} />`,
    metadata: { nestable: true, props: { svgSize: selected.size, imports } },
};
