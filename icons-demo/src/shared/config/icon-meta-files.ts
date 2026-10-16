import glyph from './meta_glyph.json';
import glyph26 from './meta_glyph-26.json';
import rocky from './meta_rocky.json';
import ios from './meta_ios.json';
import android from './meta_android.json';
import corp from './meta_corp.json';
import invest from './meta_invest.json';
import site from './meta_site.json';
import flag from './meta_flag.json';
import logo from './meta_logo.json';
import logotype from './meta_logotype.json';
import logo_am from './meta_logo-am.json';
import logo_corp from './meta_logo-corp.json';

import { IconPackageName } from '../../types';
import { MetaInfo } from './types';

export const ICON_META_FILES: Readonly<Record<IconPackageName, Record<string, MetaInfo>>> = {
    [IconPackageName.GLYPH]: glyph,
    [IconPackageName.GLYPH_26]: glyph26,
    [IconPackageName.ROCKY]: rocky,
    [IconPackageName.IOS]: ios,
    [IconPackageName.ANDROID]: android,
    [IconPackageName.CORP]: corp,
    [IconPackageName.INVEST]: invest,
    [IconPackageName.SITE]: site,
    [IconPackageName.FLAG]: flag,
    [IconPackageName.LOGO]: logo,
    [IconPackageName.LOGOTYPE]: logotype,
    [IconPackageName.LOGO_AM]: logo_am,
    [IconPackageName.LOGO_CORP]: logo_corp,
};
