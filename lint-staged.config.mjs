/**
 * @type {import('lint-staged').Configuration}
 */
const config = {
    '*.{ts,tsx,js,jsx,mjs,mts,cjs,cts,css,json,yml,yaml,md}': 'prettier --write --list-different',
    'package.json': 'sort-package-json',
    './icons/**/*.svg': 'lint-svg',
    './token-converter/src/**/*.{ts,tsx}': 'pnpm --filter token-converter exec eslint',
};

export default config;
