import { defineConfig } from 'rollup';
import { globbySync } from 'globby';
import typescript from '@rollup/plugin-typescript';
import ts from 'typescript';
import fsExtra from 'fs-extra';
import path from 'node:path';

const cwd = process.cwd();

const pkg = fsExtra.readJsonSync(path.resolve(cwd, 'package.json'), { encoding: 'utf8' });

const { ScriptTarget } = ts;

export default defineConfig({
    cache: false,
    input: globbySync('src/**/*.ts(x)?', { cwd }),
    output: {
        dir: path.resolve(cwd, 'dist'),
        format: 'cjs',
        interop: 'compat',
        dynamicImportInCjs: false,
        preserveModules: true,
        preserveModulesRoot: path.resolve(cwd, 'src'),
        entryFileNames(chunk) {
            if (chunk.facadeModuleId?.includes('node_modules/')) {
                const { name } = path.parse(chunk.facadeModuleId);

                return `lib/${name}-[hash].js`;
            }
            return '[name].js';
        },
    },
    plugins: [
        typescript({
            target: ScriptTarget.ES5,
            outDir: path.resolve(cwd, 'dist'),
            outputToFilesystem: false,
            removeComments: true,
            tsconfig: path.resolve(cwd, 'tsconfig.json'),
        }),
    ],
    external: Object.keys({
        // ...(pkg.dependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
    }),
});
