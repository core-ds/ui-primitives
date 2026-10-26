import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        commonjs(), // TODO remove as soon as esm migration complete
        react(),
    ],
    base: '',
    build: {
        commonjsOptions: {
            transformMixedEsModules: true,
        },
        outDir: 'dist',
    },
});
