import { Asset, IconPackageName } from '../../types';

export const noop = () => {};

export const importAllIcons = (requireContext: any, Module: any) =>
    requireContext.keys().forEach((key: string) => {
        const moduleName = key.replace(/\.js$/, '').replace(/^\.\//, '');

        Module[moduleName] = requireContext(key)[moduleName];
    });

export const getKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>;

export const formatPackageName = (packageName: IconPackageName | Asset) => {
    const name = packageName.toLowerCase();
    let suffix = '';

    if (packageName === IconPackageName.IOS) {
        return 'iOS';
    }

    return name.charAt(0).toUpperCase() + name.slice(1) + suffix;
};

export const getKeyParts = (key: string) => key.split('-').slice(1).join('-');

export const getPackageNameAsset = (asset: Asset, ru?: boolean): string => {
    switch (asset) {
        case Asset.LOGOTYPE:
            return ru ? 'Логотипы' : 'logo';
        case Asset.FLAG:
            return ru ? 'Флажки' : 'flag';
        default:
            return ru ? 'Иконки' : 'glyph';
    }
};
