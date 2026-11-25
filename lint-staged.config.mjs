/**
 * @type {import('lint-staged').Configuration}
 */
const config = {
    '*.{ts,tsx,js,jsx,mjs,mts,cjs,cts,css,json,yml,yaml,md}': 'prettier --write --list-different',
    'package.json': 'sort-package-json',
    './icons/**/*.svg': 'lint-svg --max-warnings 0',
    './lottie/**/*': 'lint-filename',
    './lottie/**/*.json': 'minify-json',
    './token-converter/src/**/*.{ts,tsx}': 'pnpm --filter token-converter exec eslint',
};

export default config;
