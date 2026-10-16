import React, { SVGProps } from 'react';

import { MetaInfo, MetaOptions } from './shared/config/types';

export enum Asset {
    ICONS = 'icons',
    LOGOTYPE = 'logotype',
    FLAG = 'flag',
}

export enum IconPackageName {
    GLYPH = 'glyph',
    GLYPH_26 = 'glyph-26',
    ROCKY = 'rocky',
    IOS = 'ios',
    ANDROID = 'android',
    CORP = 'corp',
    INVEST = 'invest',
    SITE = 'site',
    FLAG = 'flag',
    LOGO = 'logo',
    LOGOTYPE = 'logotype',
    LOGO_AM = 'logo-am',
    LOGO_CORP = 'logo-corp',
}

export type IconCardData = Omit<MetaInfo, 'description'> & {
    packageName: IconPackageName;
};

export const CopyType: Record<string, MetaOptions> = {
    WEB_COMPONENT: 'webComponent',
} as const;

export type AnyIcon = Record<string, React.FC<SVGProps<SVGSVGElement>>>;

export type RenderIconParams = IconCardData & {
    Icon: AnyIcon[keyof AnyIcon];
};

export enum DeprecatedType {
    DEPRECATED = 'deprecated',
    NO_REPLACE = 'no_replace',
}
