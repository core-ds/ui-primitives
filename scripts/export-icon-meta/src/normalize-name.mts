const SIZES = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '20', '24'] as const;
const STYLES = ['line', 'thinline'] as const;

// Отбрасываем имя пакета
const dropPackageName = (prefix: string, name: string) => {
    const regex = new RegExp(`^${prefix}_`);
    return name.replace(regex, '');
};

// Отбрасываем модификатор цвета
const dropColorModifier = (name: string) => {
    const regex = new RegExp(`_(${SIZES.join('|')})_(\\w+)`, 'g');
    return name.replace(regex, '_$1');
};

// Отбрасываем размер
const dropSize = (name: string) => {
    const regex = new RegExp(`_(${SIZES.join('|')})`, 'g');
    return name.replace(regex, '');
};

// Отбрасываем стилевую часть (актуально для logo-corp)
const dropStyle = (name: string) => {
    const regex = new RegExp(`-(${STYLES.join('|')})`, 'g');
    return name.replace(regex, '');
};

function getTransformers(dirname: string): Array<(name: string) => string> {
    switch (dirname) {
        case 'logo-corp':
            return [dropColorModifier, dropSize, dropStyle];
        case 'android':
        case 'ios':
        case 'glyph':
        case 'corp':
        case 'invest':
        case 'rocky':
        case 'site':
            return [dropColorModifier, dropSize];
        default:
            return [];
    }
}

export const createFigmaName = (basename: string, dirname: string): string => {
    const prefix = dirname === 'logo-am' ? 'logo' : dirname;
    const noPrefixName = dropPackageName(prefix, basename);
    const transformers = getTransformers(dirname);

    return transformers.reduce((name, fn) => fn(name), noPrefixName);
};
