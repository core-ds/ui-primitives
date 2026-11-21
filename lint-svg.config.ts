import { defineConfig, filenamePlugin, forbiddenElementPlugin } from 'lint-svg';

const createPattern = ({
    sizes = [],
    colors,
    prefix,
}: {
    sizes: string[] | number[];
    colors?: string[];
    prefix?: string;
}) => {
    return new RegExp(
        String.raw`^${prefix ? `${prefix}_` : ''}[a-z0-9]+(-[a-z0-9]+)*_(${sizes.join('|')})${colors ? `(_(${colors.join('|')}))?` : ''}\.svg$`
    );
};

export default defineConfig([
    {
        ignore: 'icons/{art,dev,icon}',
    },
    {
        files: 'icons/*/*.svg',
        plugins: [forbiddenElementPlugin({ forbidden: ['clipPath'] })],
    },
    {
        files: 'icons/android/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ sizes: ['m'] }) })],
    },
    {
        files: 'icons/corp/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ prefix: 'corp', sizes: ['s', 'm', 'xxl'] }) })],
        ignore: [
            'icons/corp/corp_corp_arrows-right-left-curved-bold_m.svg', // TODO remove in the next major
        ],
    },
    {
        files: 'icons/glyph/*.svg',
        plugins: [
            filenamePlugin({
                pattern: createPattern({
                    prefix: 'glyph',
                    sizes: ['xs', 's', 'm', 'l', 'xxl'],
                    colors: ['color', 'error', 'white'],
                }),
            }),
        ],
        ignore: [
            'icons/glyph/glyph_bell-plus_m_m.svg', // TODO remove in the next major
            'icons/glyph/glyph_bulb-flash_m_m.svg', // TODO remove in the next major
            'icons/glyph/glyph_chain-circle_m_m.svg', // TODO remove in the next major
            'icons/glyph/glyph_flower_m_m.svg', // TODO remove in the next major
            'icons/glyph/glyph_sound-cross_m_m.svg', // TODO remove in the next major
        ],
    },
    {
        files: 'icons/glyph-26/*.svg',
        plugins: [
            filenamePlugin({ pattern: createPattern({ prefix: 'glyph-26', sizes: [20, 24, 32], colors: ['color'] }) }),
        ],
    },
    {
        files: 'icons/invest/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ prefix: 'invest', sizes: ['s', 'm'] }) })],
    },
    {
        files: 'icons/ios/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ sizes: ['m', 'xxl'] }) })],
    },
    {
        files: 'icons/logo-corp/*.svg',
        plugins: [
            filenamePlugin({ pattern: createPattern({ prefix: 'logo-corp', sizes: [20, 24], colors: ['color'] }) }),
        ],
        ignore: [
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-line_20.svg', // TODO rename in the next major
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-line_24.svg', // TODO rename in the next major
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-thinline_20.svg', // TODO rename in the next major
        ],
    },
    {
        files: 'icons/logotype/*.svg',
        plugins: [
            filenamePlugin({
                pattern: createPattern({
                    prefix: 'logotype',
                    sizes: ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'],
                    colors: ['color'],
                }),
            }),
        ],
    },
    {
        files: 'icons/rocky/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ prefix: 'rocky', sizes: ['s', 'm', 'xxl'] }) })],
    },
    {
        files: 'icons/shape/*.svg',
        plugins: [
            filenamePlugin({
                pattern: createPattern({ prefix: 'shape', sizes: [24, 32, 40, 48, 56, 64, 72, 80, 128] }),
            }),
        ],
    },
    {
        files: 'icons/site/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern({ prefix: 'site', sizes: ['m'] }) })],
    },
]);
