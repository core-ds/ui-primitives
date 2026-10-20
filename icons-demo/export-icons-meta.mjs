import { $ } from 'execa';
import path from 'node:path';
import { toPlatformPath } from '@actions/core';

/**
 * @type {Array<[string, undefined | string[]]>}
 */
const meta = [
    ['android'],
    ['corp'],
    ['flag'],
    ['glyph'],
    ['glyph-26'],
    ['invest'],
    ['ios'],
    ['logo'],
    ['logo-am'],
    ['logo-corp'],
    ['logotype'],
    ['rocky', ['rocky_tshirt_m.svg']],
    ['site'],
];

for (const [pack, ignore = []] of meta) {
    await $('export-icon-meta', [
        path.resolve(import.meta.dirname, toPlatformPath(`../icons/${pack}`)),
        '--out',
        path.resolve(import.meta.dirname, toPlatformPath(`src/shared/config/meta_${pack}.json`)),
        ...ignore.flatMap((item) => ['--ignore', item]),
    ]);
}
