#!/usr/bin/env node

import path from 'node:path';
import { execa } from 'execa';

const config = path.resolve(import.meta.dirname, 'config.mjs');
const { exitCode } = await execa('rollup', ['--config', config], {
    preferLocal: true,
    stdio: 'inherit',
    reject: false,
});

process.exit(exitCode);
