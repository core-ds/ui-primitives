import path from 'node:path';
import { globbyStream } from 'globby';
import { pipeline } from 'node:stream/promises';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { toPlatformPath } from '@actions/core';
import fsExtra from 'fs-extra/esm';

await yargs(hideBin(process.argv))
    .command(
        '$0 <input..>',
        'Build cdn distributive',
        (argv) =>
            argv
                .positional('input', {
                    type: 'string',
                    array: true,
                    description: 'Path(s) or pattern(s) to source of icons',
                    demandOption: true,
                })
                .option('ignore', {
                    type: 'string',
                    array: true,
                    description: 'Path(s) or pattern(s) to ignore',
                    default: [] as string[],
                })
                .option('out', {
                    type: 'string',
                    description: 'Output directory',
                    demandOption: true,
                }),
        async (argv) => {
            await pipeline(
                globbyStream(argv.input, { absolute: true, ignore: argv.ignore }),
                async function handle(files) {
                    for await (const source of files) {
                        const filename = path.basename(source);
                        const target = path.resolve(toPlatformPath(argv.out), filename);

                        await fsExtra.ensureDir(path.dirname(target));
                        await fsExtra.copy(source, target, { overwrite: false, errorOnExist: true });
                    }
                }
            );
        }
    )
    .strict()
    .parse();
