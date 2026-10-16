import { transformBaseNameToAndroid } from './transform-base-name-to-android.mjs';
import { transformBaseNameToIos } from './transform-base-name-to-ios.mjs';

type PackageTransformer = (basename: string, componentName: string) => Record<string, string>;

export const getTransformer = (packageName: string): PackageTransformer => {
    switch (packageName) {
        case 'android': {
            return (basename: string) => ({
                android: transformBaseNameToAndroid(basename),
                middle: basename,
            });
        }
        case 'ios': {
            return (basename: string, componentName: string) => ({
                web: componentName,
                webComponent: `import { ${componentName} } from '@alfalab/icons-${packageName}/${componentName}';`,
                ios: transformBaseNameToIos(basename),
                middle: basename,
                cdn: basename,
                url: `https://alfabank.servicecdn.ru/icons/${basename}.svg`,
            });
        }
        case 'logo-am': {
            return (basename: string) => ({
                android: transformBaseNameToAndroid(basename),
                ios: transformBaseNameToIos(basename),
                middle: basename,
                cdn: basename,
                url: `https://alfabank.servicecdn.ru/icons/${basename}.svg`,
            });
        }
        case 'site': {
            return (basename: string, componentName: string) => ({
                web: componentName,
                webComponent: `import { ${componentName} } from '@alfalab/icons-${packageName}/${componentName}';`,
                middle: basename,
                cdn: basename,
                url: `https://alfabank.servicecdn.ru/icons/${basename}.svg`,
            });
        }
        default: {
            return (basename: string, componentName: string) => ({
                web: componentName,
                webComponent: `import { ${componentName} } from '@alfalab/icons-${packageName}/${componentName}';`,
                android: transformBaseNameToAndroid(basename),
                ios: transformBaseNameToIos(basename),
                middle: basename,
                cdn: basename,
                url: `https://alfabank.servicecdn.ru/icons/${basename}.svg`,
            });
        }
    }
};
