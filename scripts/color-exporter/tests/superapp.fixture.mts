import { document, page, section, frame, rectangle } from './fixtures.mjs';

// Зафиксированный результат до изменения раскладки.
// Все восемь записей заданы независимо от формул экспортёра.
export const superappBaseline = `${JSON.stringify({
    "dark_superapp_component_bg_secondary": {
        "rgba": "rgba(59, 59, 64, 1)",
        "hex": "#3b3b40",
        "figma": "superapp-component-bg/secondary",
        "web": "--color-dark-superapp-component-bg-secondary",
        "alias": "superappComponentBgColorSecondary"
    },
    "dark_superapp_component_bg_secondary_press": {
        "rgba": "rgba(63, 63, 69, 1)",
        "hex": "#3f3f45",
        "figma": "superapp-component-bg/secondary/press",
        "web": "--color-dark-superapp-component-bg-secondary-press",
        "alias": "superappComponentBgColorSecondaryPress"
    },
    "dark_superapp_surface_bg_primary": {
        "rgba": "rgba(28, 28, 30, 1)",
        "hex": "#1c1c1e",
        "figma": "superapp-surface-bg/primary",
        "web": "--color-dark-superapp-surface-bg-primary",
        "alias": "superappSurfaceBgColorPrimary"
    },
    "dark_superapp_surface_bg_secondary": {
        "rgba": "rgba(40, 40, 43, 1)",
        "hex": "#28282b",
        "figma": "superapp-surface-bg/secondary",
        "web": "--color-dark-superapp-surface-bg-secondary",
        "alias": "superappSurfaceBgColorSecondary"
    },
    "light_superapp_component_bg_secondary": {
        "rgba": "rgba(248, 248, 248, 1)",
        "hex": "#f8f8f8",
        "figma": "superapp-component-bg/secondary",
        "web": "--color-light-superapp-component-bg-secondary",
        "alias": "superappComponentBgColorSecondary"
    },
    "light_superapp_component_bg_secondary_press": {
        "rgba": "rgba(242, 242, 242, 1)",
        "hex": "#f2f2f2",
        "figma": "superapp-component-bg/secondary/press",
        "web": "--color-light-superapp-component-bg-secondary-press",
        "alias": "superappComponentBgColorSecondaryPress"
    },
    "light_superapp_surface_bg_primary": {
        "rgba": "rgba(252, 252, 252, 1)",
        "hex": "#fcfcfc",
        "figma": "superapp-surface-bg/primary",
        "web": "--color-light-superapp-surface-bg-primary",
        "alias": "superappSurfaceBgColorPrimary"
    },
    "light_superapp_surface_bg_secondary": {
        "rgba": "rgba(255, 255, 255, 1)",
        "hex": "#ffffff",
        "figma": "superapp-surface-bg/secondary",
        "web": "--color-light-superapp-surface-bg-secondary",
        "alias": "superappSurfaceBgColorSecondary"
    }
}, null, '\t')}\n`;

// Актуальные пути заданы отдельно от прежних псевдонимов и формул экспортёра.
const currentPaths: Record<string, string> = {
    dark_superapp_component_bg_secondary: 'superapp-component/bg-secondary',
    dark_superapp_component_bg_secondary_press: 'superapp-component/bg-secondary/press',
    dark_superapp_surface_bg_primary: 'superapp-surface/bg-primary',
    dark_superapp_surface_bg_secondary: 'superapp-surface/bg-secondary',
    light_superapp_component_bg_secondary: 'superapp-component/bg-secondary',
    light_superapp_component_bg_secondary_press: 'superapp-component/bg-secondary/press',
    light_superapp_surface_bg_primary: 'superapp-surface/bg-primary',
    light_superapp_surface_bg_secondary: 'superapp-surface/bg-secondary',
};
export const superappExpected = `${JSON.stringify(Object.fromEntries(
    Object.entries(JSON.parse(superappBaseline) as Record<string, Record<string, string>>)
        .map(([key, token]) => [key, { ...token, figma: currentPaths[key] }]),
), null, '\t')}\n`;

const sample = (name: string, rgb: number[]) => rectangle(name, {
    styles: undefined,
    fills: [{
        type: 'SOLID',
        color: { r: rgb[0]! / 255, g: rgb[1]! / 255, b: rgb[2]! / 255 },
        boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'superapp-color' } },
    }],
});

export const superappSource = () => document(page('colors_superapp.json', [
    section('light/superapp-surface', [
        frame('bg-primary', [sample('default', [252, 252, 252])]),
        frame('bg-secondary', [sample('default', [255, 255, 255])]),
    ]),
    section('light/superapp-component', [
        frame('bg-secondary', [sample('default', [248, 248, 248]), rectangle('empty', { fills: [] }), sample('press', [242, 242, 242])]),
    ]),
    section('dark/superapp-surface', [
        frame('bg-primary', [sample('default', [28, 28, 30])]),
        frame('bg-secondary', [sample('default', [40, 40, 43])]),
    ]),
    section('dark/superapp-component', [
        frame('bg-secondary', [sample('default', [59, 59, 64]), rectangle('empty', { fills: [] }), sample('press', [63, 63, 69])]),
    ]),
]));
