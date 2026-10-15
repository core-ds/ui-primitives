import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Удалённое правило набора не должно продолжать работать из старой сборки.
rmSync(join(root, 'dist/color-exporter'), { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc')], { cwd: root, stdio: 'inherit' });
