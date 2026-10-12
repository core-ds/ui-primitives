import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { pipeline } from 'node:stream/promises';
import { globbyStream } from 'globby';
import fsExtra from 'fs-extra/esm';
import path from 'node:path';
import { createComponent } from './index.mjs';

await yargs(hideBin(process.argv))
    .command(
        '$0 [input]',
        'Generate react component from svg',
        (builder) =>
            builder
                .positional('input', {
                    type: 'string',
                    array: true,
                    description: 'Path or pattern to the source of svg',
                    default: [],
                })
                .option('out', {
                    type: 'string',
                    description: 'Output directory',
                    demandOption: true,
                }),
        async (argv) => {
            const out = path.resolve(process.cwd(), argv.out);

            await fsExtra.ensureDir(out);

            await pipeline(globbyStream(argv.input, { absolute: true }), async (files) => {
                for await (const file of files) {
                    await createComponent(file, out);
                }
            });
        }
    )
    .parse();
