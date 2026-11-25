#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { EOL } from 'node:os';
import slash from 'slash';
import { globbyStream, globby } from 'globby';
import { cosmiconfig } from 'cosmiconfig';
import micromatch from 'micromatch';
import type { Config } from './index.mjs';

await yargs(hideBin(process.argv))
    .command(
        '$0 [input..]',
        'Lint filenames matched by config',
        (argv) =>
            argv.positional('input', {
                type: 'string',
                array: true,
                description: 'Path(s) or pattern(s) to file(s)',
                demandOption: false,
            }),
        async (argv) => {
            const cwd = process.cwd();
            const result = await cosmiconfig('lint-filename').search();

            if (result === null) {
                throw new Error('lint-filename config is not found');
            }

            const input =
                argv.input &&
                (await globby(
                    argv.input.map((value) => slash(path.isAbsolute(value) ? path.relative(cwd, value) : value))
                ));
            let errors = 0;

            await pipeline(
                Readable.from(result.config as Config[]) as {
                    [Symbol.asyncIterator](): NodeJS.AsyncIterator<Config>;
                },
                async function* lint(source) {
                    for await (const { files, ignore = [], pattern } of source) {
                        const inputSource = input
                            ? micromatch(input, files, { ignore })
                            : globbyStream(files, { ignore: [ignore].flat() });

                        for await (const file of inputSource) {
                            const filename = path.basename(file);

                            if (!pattern.test(filename)) {
                                errors += 1;

                                yield `${file}${EOL}  Filename "${filename}" does not match ${pattern}${EOL}${EOL}`;
                            }
                        }
                    }

                    if (errors > 0) {
                        yield `✖ ${errors} problem${errors === 1 ? '' : 's'}${EOL}`;
                    }
                },
                process.stdout
            );

            process.exitCode = errors > 0 ? 1 : 0;
        }
    )
    .strict()
    .parse();
