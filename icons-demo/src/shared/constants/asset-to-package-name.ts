import { Asset, IconPackageName } from '../../types';

type Assets = Record<Asset, { value: IconPackageName; label: string }[]>;

export const ASSET_TO_PACKAGE_NAME: Assets = {
    icons: [
        { value: IconPackageName.GLYPH, label: 'Glyph' },
        { value: IconPackageName.GLYPH_26, label: 'Glyph-26' },
        { value: IconPackageName.ROCKY, label: 'Rocky' },
        { value: IconPackageName.IOS, label: 'iOS' },
        { value: IconPackageName.ANDROID, label: 'Android' },
        { value: IconPackageName.CORP, label: 'Corp' },
        { value: IconPackageName.INVEST, label: 'Invest' },
        { value: IconPackageName.SITE, label: 'Site' },
    ],
    logotype: [
        { value: IconPackageName.LOGO, label: 'Logo' },
        { value: IconPackageName.LOGO_AM, label: 'Logo-am' },
        { value: IconPackageName.LOGOTYPE, label: 'Logotype' },
        { value: IconPackageName.LOGO_CORP, label: 'Logo-corp' },
    ],
    flag: [],
};
