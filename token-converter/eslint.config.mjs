// @ts-check

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig({
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['dist/**', 'eslint.config.js'],
    extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.recommended(),
    ],
    languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
});
