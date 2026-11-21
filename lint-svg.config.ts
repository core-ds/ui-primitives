import { defineConfig } from 'lint-svg';

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
        rules: {
            'forbidden-element': ['warn', { allow: ['mask', 'linearGradient', 'radialGradient'] }],
        },
    },
    {
        files: 'icons/{android,ios}/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern() }],
        },
    },
    {
        files: 'icons/corp/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('corp') }],
        },
    },
    {
        files: 'icons/glyph/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('glyph') }],
        },
    },
    {
        files: 'icons/glyph-26/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('glyph-26') }],
        },
    },
    {
        files: 'icons/invest/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('invest') }],
        },
    },
    {
        files: 'icons/logo-corp/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('logo-corp') }],
        },
    },
    {
        files: 'icons/logotype/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('logotype') }],
        },
    },
    {
        files: 'icons/rocky/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('rocky') }],
        },
    },
    {
        files: 'icons/shape/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('shape') }],
        },
    },
    {
        files: 'icons/site/*.svg',
        rules: {
            filename: ['error', { pattern: createPattern('site') }],
        },
    },
]);
