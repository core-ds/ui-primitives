// @ts-check

/**
 * @type {import('lint-staged').Configuration}
 */
const config = {
    '*.{ts,tsx,js,jsx,mjs,mts,cjs,cts,css,json,yml,md}': 'prettier --write --list-different',
    'package.json': 'sort-package-json',
    '*.svg': 'lint-svg',
};

export default config;
