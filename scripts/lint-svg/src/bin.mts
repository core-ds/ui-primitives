#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import { EOL } from 'node:os';
import slash from 'slash';
import { globbyStream, globby } from 'globby';
import { cosmiconfig } from 'cosmiconfig';
import { Config } from './index.mjs';
import { verify } from './rules.mjs';
import { toPlatformPath } from '@actions/core';
import micromatch from 'micromatch';
import { ensureArray } from './utils.mjs';

await yargs(hideBin(process.argv))
    .command(
        '$0 [input..]',
        'Lint svg files matched by config',
        (argv) =>
            argv
                .positional('input', {
                    type: 'string',
                    array: true,
                    description: 'Path(s) or pattern(s) to SVG source(s)',
                    demandOption: false,
                })
                .option('quiet', {
                    type: 'boolean',
                    default: false,
                    description: 'Report errors only',
                }),
        async (argv) => {
            const cwd = process.cwd();
            const result = await cosmiconfig('lint-svg').search();

            if (result === null) {
                throw new Error('lint-svg config is not found');
            }

            const configs = ensureArray((result.config as Config | Config[] | undefined) ?? []);
            let errors = 0;
            // Like in ESLint, an object with `ignore` only ignores files for every other object
            const globalIgnore = configs
                .filter(({ files, rules }) => files === undefined && rules === undefined)
                .flatMap(({ ignore = [] }) => ignore);
            let input: string[] | undefined;

            if (argv.input) {
                const pathsOrPatterns = argv.input.map((value) =>
                    slash(path.isAbsolute(value) ? path.relative(cwd, value) : value)
                );

                input = (await globby(pathsOrPatterns, { ignore: globalIgnore })).map((p) => slash(p));
            }
            await pipeline(
                Readable.from(configs) as {
                    [Symbol.asyncIterator](): NodeJS.AsyncIterator<Config>;
                },
                async function* lint(source) {
                    let warnings = 0;

                    for await (const config of source) {
                        if (config.files === undefined || config.rules === undefined) {
                            continue;
                        }

                        const inputSource = input
                            ? (Readable.from(
                                  micromatch(input, config.files, { ignore: config.ignore }).map((p) =>
                                      path.join(cwd, toPlatformPath(p))
                                  )
                              ) as { [Symbol.asyncIterator](): NodeJS.AsyncIterator<string> })
                            : globbyStream(config.files, {
                                  absolute: true,
                                  ignore: [...ensureArray(config.ignore ?? []), ...globalIgnore],
                              });

                        for await (const file of inputSource) {
                            const content = await fs.readFile(file, { encoding: 'utf8' });
                            const problems = verify(file, content, config.rules).filter(
                                ({ severity }) => !argv.quiet || severity === 'error'
                            );

                            if (problems.length === 0) {
                                continue;
                            }

                            const lines = [slash(path.relative(cwd, file))];

                            for (const { index, severity, message, rule } of problems) {
                                const before = content.slice(0, index).split(/\r?\n/);
                                const position = `${before.length}:${before[before.length - 1].length + 1}`;

                                if (severity === 'error') {
                                    errors += 1;
                                } else {
                                    warnings += 1;
                                }

                                lines.push(`  ${position.padEnd(8)}${severity.padEnd(7)}  ${message}  ${rule}`);
                            }

                            yield `${lines.join(EOL)}${EOL}${EOL}`;
                        }
                    }

                    const total = errors + warnings;

                    if (total > 0) {
                        const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

                        yield `✖ ${plural(total, 'problem')} (${plural(errors, 'error')}, ${plural(warnings, 'warning')})${EOL}`;
                    }
                },
                process.stdout
            );

            process.exitCode = errors > 0 ? 1 : 0;
        }
    )
    .parse();
