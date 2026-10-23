#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import { EOL } from 'node:os';
import slash from 'slash';
import { globbyStream } from 'globby';
import { cosmiconfig } from 'cosmiconfig';
import { Config } from './index.mjs';

await yargs(hideBin(process.argv))
    .command(
        '$0 [input..]',
        'Lint svg',
        (builder) =>
            builder
                .positional('input', {
                    type: 'string',
                    array: true,
                    description: 'Path(s) or pattern(s) to SVG source(s)',
                    demandOption: true,
                })
                .option('exit-code', {
                    type: 'number',
                    description: 'Exit code if any error is found',
                }),
        async (argv) => {
            const result = await cosmiconfig('lint-svg').search();
            const config = result?.config as Config | undefined;

            await pipeline(
                globbyStream(
                    argv.input.map((val) => slash(val)),
                    { absolute: true, ignore: config?.ignore }
                ),
                async function* validate(paths) {
                    let exitCode = argv.exitCode ?? null;

                    for await (const p of paths) {
                        const content = await fs.readFile(p, { encoding: 'utf8' });

                        if (/\s+id="/.test(content)) {
                            if (exitCode === null) {
                                exitCode = 1;
                            }

                            yield `${slash(path.relative(process.cwd(), p))}${EOL}`;
                        }
                    }

                    process.exitCode = exitCode;
                },
                process.stdout
            );
        }
    )
    .parse();
