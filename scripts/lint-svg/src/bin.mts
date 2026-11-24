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
import { verify } from './runtime.mjs';
import { toPlatformPath } from '@actions/core';
import micromatch from 'micromatch';
import { ensureArray, isIgnoreConfig } from './utils.mjs';

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
                })
                .option('max-warnings', {
                    type: 'number',
                    default: -1,
                    description: 'Number of warnings to trigger nonzero exit code',
                })
                .check(({ 'max-warnings': maxWarnings }) => {
                    if (!Number.isInteger(maxWarnings)) {
                        throw new Error('--max-warnings must be an integer.');
                    }

                    if (maxWarnings < -1) {
                        throw new Error('--max-warnings must more or equal to "-1"');
                    }

                    return true;
                }),
        async (argv) => {
            const cwd = process.cwd();
            const result = await cosmiconfig('lint-svg').search();

            if (result === null) {
                throw new Error('lint-svg config is not found');
            }

            const configs = ensureArray((result.config as Config | Config[] | undefined) ?? []);
            let errors = 0;
            let warnings = 0;
            const tooManyWarnings = () => argv.maxWarnings >= 0 && warnings > argv.maxWarnings;
            const globalIgnore = configs.filter(isIgnoreConfig).flatMap(({ ignore }) => ignore);
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

                async function* filter(source) {
                    for await (const config of source) {
                        if (isIgnoreConfig(config)) {
                            continue;
                        }

                        yield config;
                    }
                },
                async function* lint(source) {
                    for await (const config of source) {
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
                            const problems = await verify(file, content, config.plugins);

                            errors += problems.filter(({ severity }) => severity === 'error').length;
                            warnings += problems.filter(({ severity }) => severity === 'warning').length;

                            // Like in ESLint, quiet warnings are not reported but still count towards --max-warnings
                            const reported = problems.filter(({ severity }) => !argv.quiet || severity === 'error');

                            if (reported.length === 0) {
                                continue;
                            }

                            const lines = [slash(path.relative(cwd, file))];

                            for (const { index, severity, message, plugin } of reported) {
                                const before = content.slice(0, index).split(/\r?\n/);
                                const position = `${before.length}:${before[before.length - 1].length + 1}`;

                                lines.push(`  ${position.padEnd(8)}${severity.padEnd(7)}  ${message}  ${plugin}`);
                            }

                            yield `${lines.join(EOL)}${EOL}${EOL}`;
                        }
                    }

                    const reportedWarnings = argv.quiet ? 0 : warnings;
                    const total = errors + reportedWarnings;

                    if (total > 0) {
                        const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

                        yield `✖ ${plural(total, 'problem')} (${plural(errors, 'error')}, ${plural(reportedWarnings, 'warning')})${EOL}`;
                    }

                    if (tooManyWarnings()) {
                        yield `${EOL}lint-svg found too many warnings (maximum: ${argv.maxWarnings}).${EOL}`;
                    }
                },
                process.stdout
            );

            process.exitCode = errors > 0 || tooManyWarnings() ? 1 : 0;
        }
    )
    .strict()
    .parse();
