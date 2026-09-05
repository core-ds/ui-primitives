import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { workspaceFile } from './test-paths.mjs';

interface Scenario {
    name: string;
    changed: string[];
    deleted: string[];
    release?: 'minor' | 'major';
}

const fixturePath = 'scripts/color-exporter/tests/fixtures/full/repository/styles/colors_example.json';
const scenarios: Scenario[] = [
    { name: 'новые эталоны цветов не вызывают релиз', changed: [fixturePath], deleted: [] },
    { name: 'удалённые эталоны цветов не вызывают релиз', changed: [fixturePath], deleted: [fixturePath] },
    { name: 'исходники и документация не вызывают релиз', changed: ['scripts/color-exporter/src/cli.mts', 'scripts/color-exporter/README.md'], deleted: [] },
    { name: 'изменение корневых цветов вызывает minor', changed: ['styles/colors_example.json'], deleted: [], release: 'minor' },
    { name: 'новая корневая иконка вызывает minor', changed: ['icons/glyph/example.svg'], deleted: [], release: 'minor' },
    { name: 'удаление корневой анимации вызывает major', changed: ['animations/example.json'], deleted: ['animations/example.json'], release: 'major' },
    { name: 'удаление эталона не повышает minor реального ассета до major', changed: ['styles/colors_example.json', fixturePath], deleted: [fixturePath], release: 'minor' },
];

for (const scenario of scenarios) {
    test(`релизный фильтр: ${scenario.name}`, async () => {
        const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-release-'));
        try {
            const bin = path.join(temporaryRoot, 'bin');
            const changed = path.join(temporaryRoot, 'changed.txt');
            const deleted = path.join(temporaryRoot, 'deleted.txt');
            const calls = path.join(temporaryRoot, 'npm-calls.txt');
            await mkdir(bin);

            // Выполняется настоящий ci.sh, но Git и npm полностью подменены.
            // Даже команды настройки Git и выпуска пакета только имитируются.
            const gitStub = [
                '#!/bin/bash',
                'case "$1" in',
                '  describe) printf "test-tag\\n" ;;',
                '  diff)',
                '    case "$*" in',
                '      *--diff-filter=D*) /bin/cat "$RELEASE_TEST_DELETED" ;;',
                '      *) /bin/cat "$RELEASE_TEST_CHANGED" ;;',
                '    esac ;;',
                'esac',
                'exit 0',
                '',
            ].join('\n');
            const npmStub = '#!/bin/bash\nprintf "%s\\n" "$*" >> "$RELEASE_TEST_CALLS"\n';
            await Promise.all([
                writeFile(path.join(bin, 'git'), gitStub, { mode: 0o755 }),
                writeFile(path.join(bin, 'npm'), npmStub, { mode: 0o755 }),
                writeFile(changed, scenario.changed.join('\n') + '\n'),
                writeFile(deleted, scenario.deleted.join('\n') + '\n'),
                writeFile(calls, ''),
            ]);

            const result = spawnSync('/bin/bash', [workspaceFile('utils', 'ci.sh')], {
                cwd: temporaryRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PATH: `${bin}:/usr/bin:/bin`,
                    RELEASE_TEST_CHANGED: changed,
                    RELEASE_TEST_DELETED: deleted,
                    RELEASE_TEST_CALLS: calls,
                },
            });
            assert.equal(result.status, 0, result.stderr);
            const commands = (await readFile(calls, 'utf8')).trim();
            assert.equal(commands, scenario.release ? `ci\nrun release-${scenario.release}` : '');
        } finally {
            await rm(temporaryRoot, { recursive: true, force: true });
        }
    });
}
