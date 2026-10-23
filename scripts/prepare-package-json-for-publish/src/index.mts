#!/usr/bin/env node

import fsExtra from 'fs-extra/esm';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const FIELDS_TO_REMOVE = ['scripts', 'devDependencies', 'publishConfig'];

async function cleanPackageJson(input: string, out: string) {
    const src = path.resolve(process.cwd(), input);
    const dest = path.resolve(process.cwd(), out);

    const pkg = await fsExtra.readJson(src, { encoding: 'utf8' });

    for (const field of FIELDS_TO_REMOVE) {
        delete pkg[field];
    }

    await fsExtra.writeJson(dest, pkg, { encoding: 'utf8', spaces: 4 });
}

await yargs(hideBin(process.argv))
    .command(
        '$0 [input]',
        'Remove scripts, devDependencies and publishConfig fields from a package.json',
        (builder) =>
            builder
                .positional('input', {
                    type: 'string',
                    description: 'Path to the source package.json',
                    default: 'package.json',
                })
                .option('out', {
                    type: 'string',
                    description: 'Output path for the prepared package.json',
                    demandOption: true,
                }),
        (argv) => cleanPackageJson(argv.input, argv.out)
    )
    .parse();
