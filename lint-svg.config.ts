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
