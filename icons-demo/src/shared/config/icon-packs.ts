import { AnyIcon, IconPackageName } from '../../types';
import { importAllIcons } from '../utils';

const IconsGlyph: AnyIcon = {};
const IconsGlyph26: AnyIcon = {};
const IconsRocky: AnyIcon = {};
const IconsIos: AnyIcon = {};
const IconsAndroid: AnyIcon = {};
const IconsCorp: AnyIcon = {};
const IconsLogotype: AnyIcon = {};
const IconsFlag: AnyIcon = {};
const IconsInvest: AnyIcon = {};
const IconsSite: AnyIcon = {};
const IconsLogo: AnyIcon = {};
const IconsLogoAm: AnyIcon = {};
const IconsLogoCorp: AnyIcon = {};

importAllIcons(require.context('@alfalab/icons-glyph/dist', false, /Icon\.js$/), IconsGlyph);
importAllIcons(require.context('@alfalab/icons-glyph-26/dist', false, /Icon\.js$/), IconsGlyph26);
importAllIcons(require.context('@alfalab/icons-rocky/dist', false, /Icon\.js$/), IconsRocky);
importAllIcons(require.context('@alfalab/icons-ios/dist', false, /Icon\.js$/), IconsIos);
importAllIcons(require.context('@alfalab/icons-android/dist', false, /Icon\.js$/), IconsAndroid);
importAllIcons(require.context('@alfalab/icons-corp/dist', false, /Icon\.js$/), IconsCorp);
importAllIcons(require.context('@alfalab/icons-logotype/dist', false, /Icon\.js$/), IconsLogotype);
importAllIcons(require.context('@alfalab/icons-flag/dist', false, /Icon\.js$/), IconsFlag);
importAllIcons(require.context('@alfalab/icons-invest/dist', false, /Icon\.js$/), IconsInvest);
importAllIcons(require.context('@alfalab/icons-site/dist', false, /Icon\.js$/), IconsSite);
importAllIcons(require.context('@alfalab/icons-logo/dist', false, /Icon\.js$/), IconsLogo);
importAllIcons(require.context('@alfalab/icons-logo-am/dist', false, /Icon\.js$/), IconsLogoAm);
importAllIcons(require.context('@alfalab/icons-logo-corp/dist', false, /Icon\.js$/), IconsLogoCorp);

export const ICONS = {
    [IconPackageName.GLYPH]: IconsGlyph,
    [IconPackageName.GLYPH_26]: IconsGlyph26,
    [IconPackageName.ROCKY]: IconsRocky,
    [IconPackageName.IOS]: IconsIos,
    [IconPackageName.ANDROID]: IconsAndroid,
    [IconPackageName.CORP]: IconsCorp,
    [IconPackageName.LOGOTYPE]: IconsLogotype,
    [IconPackageName.FLAG]: IconsFlag,
    [IconPackageName.INVEST]: IconsInvest,
    [IconPackageName.SITE]: IconsSite,
    [IconPackageName.LOGO]: IconsLogo,
    [IconPackageName.LOGO_AM]: IconsLogoAm,
    [IconPackageName.LOGO_CORP]: IconsLogoCorp,
};
