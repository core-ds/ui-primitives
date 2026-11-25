#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fsExtra from 'fs-extra';
import { globbyStream } from 'globby';

await yargs(hideBin(process.argv))
    .command(
        '$0 <input..>',
        'Format JSON files onto one line',
        (argv) =>
            argv.positional('input', {
                type: 'string',
                array: true,
                description: 'Path(s) or pattern(s) to JSON file(s)',
                demandOption: true,
            }),
        async (argv) => {
            for await (const file of globbyStream(argv.input)) {
                await fsExtra.writeJson(file, await fsExtra.readJson(file), { encoding: 'utf8' });
            }
        }
    )
    .strict()
    .parse();
