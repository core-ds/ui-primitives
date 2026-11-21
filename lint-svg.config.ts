import { defineConfig, filenamePlugin, forbiddenElementPlugin } from 'lint-svg';

const createPattern = (prefix?: string) => {
    return prefix
        ? new RegExp(String.raw`^${prefix}_[a-z0-9]+(-[a-z0-9]+)*_[a-z0-9]+(_[a-z0-9]+)*\.svg$`)
        : /^[a-z0-9]+(-[a-z0-9]+)*_[a-z0-9]+\.svg$/;
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
        files: 'icons/{android,ios}/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern() })],
    },
    {
        files: 'icons/corp/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('corp') })],
        ignore: [
            'icons/corp/corp_corp_arrows-right-left-curved-bold_m.svg', // TODO remove in next major
        ],
    },
    {
        files: 'icons/glyph/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('glyph') })],
    },
    {
        files: 'icons/glyph-26/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('glyph-26') })],
    },
    {
        files: 'icons/invest/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('invest') })],
    },
    {
        files: 'icons/logo-corp/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('logo-corp') })],
        ignore: [
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-line_20.svg', // TODO rename in next major
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-line_24.svg', // TODO rename in next major
            'icons/logo-corp/logo-corp_Issue-invoice-sign-box-thinline_20.svg', // TODO rename in next major
        ],
    },
    {
        files: 'icons/logotype/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('logotype') })],
    },
    {
        files: 'icons/rocky/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('rocky') })],
    },
    {
        files: 'icons/shape/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('shape') })],
    },
    {
        files: 'icons/site/*.svg',
        plugins: [filenamePlugin({ pattern: createPattern('site') })],
    },
]);
