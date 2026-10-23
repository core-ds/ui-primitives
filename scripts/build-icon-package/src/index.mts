#!/usr/bin/env node

import path from 'node:path';
import { execa } from 'execa';

const config = path.resolve(import.meta.dirname, 'rollup.config.mjs');
const { exitCode } = await execa('rollup', ['--config', config], {
    preferLocal: true,
    localDir: import.meta.dirname, // https://github.com/sindresorhus/execa/issues/1204
    stdio: 'inherit',
    reject: false,
});

process.exit(exitCode);
