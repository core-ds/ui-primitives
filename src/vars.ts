import colorsAddons from "ui-primitives/styles/colors_addons.json";
import colorsBluetint from "ui-primitives/styles/colors_bluetint.json";
import colorsDecorative from "ui-primitives/styles/colors_decorative.json";
import colorsPfm from "ui-primitives/styles/colors_pfm.json";
import colorsQualitative from "ui-primitives/styles/colors_qualitative.json";
import colorsSequential from "ui-primitives/styles/colors_sequential.json";
import colorsTransparent from "ui-primitives/styles/colors_transparent.json";

import typographyAndroid from "ui-primitives/styles/typography_android.json";
import typographyIos from "ui-primitives/styles/typography_ios.json";
import typographyWeb from "ui-primitives/styles/typography_web.json";

export const colors = {
    ...colorsAddons,
    ...colorsBluetint,
    ...colorsDecorative,
    ...colorsPfm,
    ...colorsQualitative,
    ...colorsSequential,
    ...colorsTransparent,
} as unknown as Record<
    string,
    {
        rgba: string;
        hex: string;
        alias: string;
        web: string;
    }
>;

export const typography = {
    android: typographyAndroid,
    ios: typographyIos,
    web: typographyWeb,
};
