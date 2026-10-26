import colorsAddons from '../../styles/colors_addons.json';
import colorsBluetint from '../../styles/colors_bluetint.json';
import colorsDecorative from '../../styles/colors_decorative.json';
import colorsPfm from '../../styles/colors_pfm.json';
import colorsQualitative from '../../styles/colors_qualitative.json';
import colorsSequential from '../../styles/colors_sequential.json';
import colorsTransparent from '../../styles/colors_transparent.json';
import colorsMonochrome from '../../styles/colors_monochrome.json';
import colorsBrand from '../../styles/colors_brand.json';
import colorsPromo from '../../styles/colors_promo.json';

import typographyAndroid from '../../styles/typography_android.json';
import typographyIos from '../../styles/typography_ios.json';
import typographyWeb from '../../styles/typography_web.json';

export const colors: Record<
    string,
    {
        rgba: string;
        hex: string;
        alias: string;
        figma?: string;
        web: string;
    }
> = {
    ...colorsAddons,
    ...colorsBluetint,
    ...colorsDecorative,
    ...colorsPfm,
    ...colorsQualitative,
    ...colorsSequential,
    ...colorsTransparent,
    ...colorsMonochrome,
    ...colorsBrand,
    ...colorsPromo,
};

export const typography = {
    android: typographyAndroid,
    ios: typographyIos,
    web: typographyWeb,
};
