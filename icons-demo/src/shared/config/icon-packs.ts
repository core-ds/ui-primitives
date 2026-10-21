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

importAllIcons(require.context('@alfalab/icons-glyph', false, /Icon\.js$/), IconsGlyph);
importAllIcons(require.context('@alfalab/icons-glyph-26', false, /Icon\.js$/), IconsGlyph26);
importAllIcons(require.context('@alfalab/icons-rocky', false, /Icon\.js$/), IconsRocky);
importAllIcons(require.context('@alfalab/icons-ios', false, /Icon\.js$/), IconsIos);
importAllIcons(require.context('@alfalab/icons-android', false, /Icon\.js$/), IconsAndroid);
importAllIcons(require.context('@alfalab/icons-corp', false, /Icon\.js$/), IconsCorp);
importAllIcons(require.context('@alfalab/icons-logotype', false, /Icon\.js$/), IconsLogotype);
importAllIcons(require.context('@alfalab/icons-flag', false, /Icon\.js$/), IconsFlag);
importAllIcons(require.context('@alfalab/icons-invest', false, /Icon\.js$/), IconsInvest);
importAllIcons(require.context('@alfalab/icons-site', false, /Icon\.js$/), IconsSite);
importAllIcons(require.context('@alfalab/icons-logo', false, /Icon\.js$/), IconsLogo);
importAllIcons(require.context('@alfalab/icons-logo-am', false, /Icon\.js$/), IconsLogoAm);
importAllIcons(require.context('@alfalab/icons-logo-corp', false, /Icon\.js$/), IconsLogoCorp);

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
