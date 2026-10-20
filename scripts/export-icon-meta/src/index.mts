#!/usr/bin/env node

import path from 'node:path';
import { getTransformer } from './package-strategy.mjs';
import { generateComponentName } from 'svg-to-component';
import { createFigmaName } from './normalize-name.mjs';
import { getFileComponents, getFileComponentSets } from './figma.mjs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fsExtra from 'fs-extra/esm';
import { globby } from 'globby';

function getFigmaPage(dirname: string): string {
    switch (dirname) {
        case 'glyph':
        case 'logo':
        case 'flag':
            return `general (${dirname})`;
        case 'logotype':
            return `deprecated (${dirname})`;
        default:
            return dirname;
    }
}

async function getData(dirname: string) {
    switch (dirname) {
        case 'android':
        case 'corp':
        case 'glyph':
        case 'glyph-26':
        case 'invest':
        case 'ios':
        case 'rocky':
        case 'site': {
            const {
                meta: { component_sets },
            } = await getFileComponentSets('ZcdUPebEhHfSZ91zgmv2cK');

            return component_sets;
        }
        case 'logo':
        case 'logo-am':
        case 'logotype': {
            const {
                meta: { components },
            } = await getFileComponents('yZBSrRbQbdxac3VVcscJ45');

            return components;
        }
        case 'logo-corp': {
            const {
                meta: { component_sets },
            } = await getFileComponentSets('yZBSrRbQbdxac3VVcscJ45');

            return component_sets;
        }
        case 'flag': {
            const {
                meta: { components },
            } = await getFileComponents('RHkvF3gsacdtwxSCgOCWV0');

            return components;
        }
    }
}

await yargs(hideBin(process.argv))
    .command(
        '$0 [input]',
        'Generate meta information for icons',
        (builder) =>
            builder
                .positional('input', {
                    type: 'string',
                    description: 'Path to the source of icons',
                    demandOption: true,
                })
                .option('out', {
                    type: 'string',
                    description: 'Output file',
                    demandOption: true,
                })
                .option('ignore', {
                    type: 'string',
                    array: true,
                    description: 'Path(s) or pattern(s) to ignore',
                }),
        async (argv) => {
            const input = path.resolve(process.cwd(), argv.input);
            const out = path.resolve(process.cwd(), argv.out);
            const dirname = path.basename(input);
            const descriptions = new Map(
                (await getData(dirname))
                    ?.filter((item) => item.containing_frame?.pageName === getFigmaPage(dirname))
                    .map((item) => [item.name, { name: item.name, description: item.description }])
            );
            const transformer = getTransformer(dirname);
            const meta = Object.fromEntries(
                (await globby('*.svg', { cwd: input, ignore: argv.ignore, absolute: true })).map((file) => {
                    const basename = path.parse(file).name;
                    const figmaName = createFigmaName(basename, dirname);
                    const { componentName } = generateComponentName(file);
                    const description = descriptions.get(figmaName)?.description ?? '';

                    return [componentName, { description, ...transformer(basename, componentName) }];
                })
            );

            await fsExtra.ensureDir(path.dirname(out));
            await fsExtra.writeJson(out, meta, { encoding: 'utf8', spaces: 4 });
        }
    )
    .parse();
