import { $ } from 'execa';
import path from 'node:path';
import { toPlatformPath } from '@actions/core';

for (const pack of [
    'android',
    'corp',
    'flag',
    'glyph',
    'glyph-26',
    'invest',
    'ios',
    'logo',
    'logo-am',
    'logo-corp',
    'logotype',
    'rocky',
    'site',
]) {
    await $('export-icon-meta', [
        path.resolve(import.meta.dirname, toPlatformPath(`../icons/${pack}`)),
        '--out',
        path.resolve(import.meta.dirname, toPlatformPath(`src/shared/config/meta_${pack}.json`)),
    ]);
}
