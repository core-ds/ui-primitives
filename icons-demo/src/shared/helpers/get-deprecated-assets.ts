import deprecatedIcons from '../config/deprecated-icons.json';
import deprecatedLogos from '../config/deprecated-logos.json';
import deprecatedFlags from '../config/deprecated-flags.json';

type DeprecatedAssets = Record<string, { readonly replacement: string; readonly date: string }>;

export const getDeprecatedAssets = (): DeprecatedAssets => {
    return {
        ...deprecatedIcons,
        ...deprecatedLogos,
        ...deprecatedFlags,
    };
};
