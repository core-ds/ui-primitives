import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import runGithubAction from '../src/action/run-github-action.mjs';
import { TARGET_BRANCH } from '../src/action/git-operations.mjs';
import { createDefaultOnlyPalette } from '../src/palettes/_create-default-only.mjs';
import type { ActionsExec, GithubContext } from '../src/action/types.mjs';
import type { PaletteRunResult, RunPalettesOptions } from '../src/core/types.mjs';

const TARGET_JSON = 'styles/colors_example.json';
const BASE_TEXT = '{}\n';
const DESIRED_TEXT = '{\n\t"example": {}\n}\n';
const EXAMPLE_PALETTE = createDefaultOnlyPalette({
    id: 'example',
    label: 'Example',
    description: 'Интеграционная тестовая палитра',
    pageName: 'colors_example.json',
    sectionPattern: /^static_example$/,
}).palette;

interface ProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

function runProcess(command: string, argumentsList: string[], cwd: string): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, argumentsList, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => { stdout += chunk; });
        child.stderr.on('data', (chunk: string) => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    });
}

async function runRequired(command: string, argumentsList: string[], cwd: string): Promise<ProcessResult> {
    const result = await runProcess(command, argumentsList, cwd);
    assert.equal(
        result.exitCode,
        0,
        `${command} ${argumentsList.join(' ')} завершился с ошибкой:\n${result.stderr}`,
    );
    return result;
}

function makeActionsExec(cwd: string): ActionsExec {
    return {
        async exec(command, argumentsList = []) {
            const result = await runProcess(command, argumentsList, cwd);
            if (result.exitCode !== 0) {
                throw new Error(`${command} ${argumentsList.join(' ')}: ${result.stderr}`);
            }
            return result.exitCode;
        },
        async getExecOutput(command, argumentsList = [], options = {}) {
            const result = await runProcess(command, argumentsList, cwd);
            if (result.exitCode !== 0 && options.ignoreReturnCode !== true) {
                throw new Error(`${command} ${argumentsList.join(' ')}: ${result.stderr}`);
            }
            return result;
        },
    };
}

interface TemporaryRepository {
    root: string;
    remote: string;
    seed: string;
    working: string;
    sha: string;
}

async function createTemporaryRepository(): Promise<TemporaryRepository> {
    const root = await mkdtemp(path.join(tmpdir(), 'color-exporter-git-'));
    const remote = path.join(root, 'origin.git');
    const seed = path.join(root, 'seed');
    const working = path.join(root, 'working');
    await runRequired('git', ['init', '--bare', remote], root);
    await runRequired('git', ['init', seed], root);
    await runRequired('git', ['config', 'user.name', 'Тест'], seed);
    await runRequired('git', ['config', 'user.email', 'test@example.com'], seed);
    await mkdir(path.join(seed, 'styles'), { recursive: true });
    await writeFile(path.join(seed, TARGET_JSON), BASE_TEXT, 'utf8');
    await runRequired('git', ['add', '--', TARGET_JSON], seed);
    await runRequired('git', ['commit', '-m', 'начальное состояние'], seed);
    await runRequired('git', ['branch', '-M', 'master'], seed);
    await runRequired('git', ['remote', 'add', 'origin', remote], seed);
    await runRequired('git', ['push', '-u', 'origin', 'master'], seed);
    await runRequired('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], remote);
    await runRequired('git', ['clone', remote, working], root);
    const sha = (await runRequired('git', ['rev-parse', 'HEAD'], working)).stdout.trim();
    return { root, remote, seed, working, sha };
}

function makeContext(sha: string): GithubContext {
    return {
        sha,
        ref: 'refs/heads/master',
        repo: { owner: 'core-ds', repo: 'ui-primitives' },
        payload: { repository: { default_branch: 'master' } },
    };
}

function makeResult(changed: boolean): PaletteRunResult {
    return {
        paletteId: 'example',
        targetJson: TARGET_JSON,
        changed,
        changes: {
            newTokenKeys: [],
            restoredTokenKeys: [],
            changedActiveTokenKeys: [],
            newlyDeprecatedTokenKeys: [],
        },
        summary: {
            sections: 0,
            frames: 0,
            rectangles: 0,
            placeholders: 0,
            tokens: 0,
            oldTokens: 0,
            resultTokens: 0,
            activeTokens: 0,
            deprecatedTokens: 0,
            newTokens: 0,
            restoredTokens: 0,
            changedActiveTokens: 0,
            newlyDeprecatedTokens: 0,
        },
    };
}

function makeSynchronizer(workspace: string, desiredText: string, changed: boolean) {
    return async (options: RunPalettesOptions): Promise<PaletteRunResult[]> => {
        assert.equal(await options.loadBaselineJsonText?.(TARGET_JSON), BASE_TEXT);
        await writeFile(path.join(workspace, TARGET_JSON), desiredText, 'utf8');
        return [makeResult(changed)];
    };
}

function makeGithubRecorder(openPullRequests: Array<{ number: number }> = []) {
    const calls: string[] = [];
    return {
        calls,
        rest: {
            pulls: {
                async list() { calls.push('list'); return { data: openPullRequests }; },
                async create() { calls.push('create'); },
                async update() { calls.push('update'); },
            },
        },
    };
}

async function prepareRemoteBranch(repository: TemporaryRepository, files: Record<string, string>) {
    await runRequired('git', ['checkout', '-b', TARGET_BRANCH], repository.seed);
    for (const [file, text] of Object.entries(files)) {
        await writeFile(path.join(repository.seed, file), text, 'utf8');
    }
    await runRequired('git', ['add', '--', ...Object.keys(files)], repository.seed);
    await runRequired('git', ['commit', '-m', 'ожидающие изменения'], repository.seed);
    await runRequired('git', ['push', 'origin', TARGET_BRANCH], repository.seed);
    return (await runRequired('git', ['rev-parse', 'HEAD'], repository.seed)).stdout.trim();
}

async function remoteBranchSha(repository: TemporaryRepository): Promise<string> {
    return (await runProcess('git', [
        '--git-dir', repository.remote, 'rev-parse', '--verify', `refs/heads/${TARGET_BRANCH}`,
    ], repository.root)).stdout.trim();
}

test('несогласованный результат останавливает реальный Git до коммита и отправки', async () => {
    const repository = await createTemporaryRepository();
    try {
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, false),
        }), /синхронизатор|результат/);
        assert.equal((await runRequired('git', ['rev-parse', 'HEAD'], repository.working)).stdout.trim(), repository.sha);
        assert.equal(await remoteBranchSha(repository), '');
        assert.equal(github.calls.some((call) => call !== 'list'), false);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('изменение прав активного JSON запрещено даже вместе с настоящим изменением цветов', async () => {
    const repository = await createTemporaryRepository();
    try {
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async () => {
                await writeFile(path.join(repository.working, TARGET_JSON), DESIRED_TEXT, 'utf8');
                await chmod(path.join(repository.working, TARGET_JSON), 0o755);
                return [makeResult(true)];
            },
        }), /права|режим|обычн/);
        assert.equal(await remoteBranchSha(repository), '');
        assert.equal(github.calls.length, 0);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('посторонний путь с конечным пробелом не превращается в разрешённый JSON', async () => {
    const repository = await createTemporaryRepository();
    try {
        const originalSha = await prepareRemoteBranch(repository, { [`${TARGET_JSON} `]: '{}\n' });
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, true),
        }), /посторонний файл/);
        assert.equal(await remoteBranchSha(repository), originalSha);
        assert.deepEqual(github.calls, []);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('незаписанное удаление постороннего файла не скрывает его из отправляемого дерева', async () => {
    const repository = await createTemporaryRepository();
    try {
        const originalSha = await prepareRemoteBranch(repository, { 'README.md': 'посторонний файл\n' });
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async () => {
                await rm(path.join(repository.working, 'README.md'));
                await writeFile(path.join(repository.working, TARGET_JSON), DESIRED_TEXT, 'utf8');
                return [makeResult(true)];
            },
        }), /посторонний файл README/);
        assert.equal(await remoteBranchSha(repository), originalSha);
        assert.deepEqual(github.calls, []);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('исчезнувшая новая страница удаляет незавершённый JSON и отправляет согласование', async () => {
    const repository = await createTemporaryRepository();
    try {
        await prepareRemoteBranch(repository, { 'styles/colors_new_palette.json': '{}\n' });
        const github = makeGithubRecorder();
        const result = await runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async () => [],
        });
        assert.equal(result.changed, false);
        assert.equal(result.pushed, true);
        assert.deepEqual(result.revertedPaths, ['styles/colors_new_palette.json']);
        assert.equal((await runRequired('git', [
            '--git-dir', repository.remote, 'diff', '--name-only', 'master', TARGET_BRANCH,
        ], repository.root)).stdout, '');
        assert.deepEqual(github.calls, ['list']);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('обновление основы отправляется даже без новых изменений в индексе', async () => {
    const repository = await createTemporaryRepository();
    try {
        await prepareRemoteBranch(repository, { [TARGET_JSON]: DESIRED_TEXT });
        await runRequired('git', ['checkout', 'master'], repository.seed);
        await writeFile(path.join(repository.seed, 'README.md'), 'новая основа\n', 'utf8');
        await runRequired('git', ['add', 'README.md'], repository.seed);
        await runRequired('git', ['commit', '-m', 'обновление основы'], repository.seed);
        await runRequired('git', ['push', 'origin', 'master'], repository.seed);
        const baseSha = (await runRequired('git', ['rev-parse', 'HEAD'], repository.seed)).stdout.trim();
        await runRequired('git', ['fetch', 'origin', 'master'], repository.working);
        const github = makeGithubRecorder();
        const result = await runGithubAction({
            github,
            context: makeContext(baseSha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, true),
        });
        assert.deepEqual(result.stagedPaths, []);
        assert.equal(result.pushed, true);
        await runRequired('git', [
            '--git-dir', repository.remote, 'merge-base', '--is-ancestor', baseSha, TARGET_BRANCH,
        ], repository.root);
        assert.deepEqual(github.calls, ['list', 'create']);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('устаревший открытый реквест виден в журнале запуска', async () => {
    const repository = await createTemporaryRepository();
    try {
        const reports: string[] = [];
        const github = makeGithubRecorder([{ number: 17 }]);
        const result = await runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, BASE_TEXT, false),
            report: (message) => reports.push(message),
        });
        assert.equal(result.stalePullRequest, true);
        assert.ok(reports.some((message) => /#17/.test(message) && /вручную/.test(message)));
        assert.deepEqual(github.calls, ['list']);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('новая стандартная страница создаёт JSON, а посторонний неотслеживаемый файл не отправляется', async () => {
    const repository = await createTemporaryRepository();
    try {
        const newTarget = 'styles/colors_future_palette.json';
        const github = makeGithubRecorder();
        const result = await runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async (options) => {
                assert.equal(await options.loadBaselineJsonText?.(newTarget), undefined);
                await writeFile(path.join(repository.working, newTarget), DESIRED_TEXT, 'utf8');
                await writeFile(path.join(repository.working, 'local-note.txt'), 'локальная заметка\n', 'utf8');
                return [{ ...makeResult(true), paletteId: 'future-palette', targetJson: newTarget }];
            },
        });
        assert.deepEqual(result.branchPaths, [newTarget]);
        assert.equal(result.pushed, true);
        assert.equal((await runRequired('git', [
            '--git-dir', repository.remote, 'ls-tree', '--name-only', TARGET_BRANCH, '--', 'local-note.txt',
        ], repository.root)).stdout, '');
        assert.equal((await runRequired('git', [
            '--git-dir', repository.remote, 'show', `${TARGET_BRANCH}:${newTarget}`,
        ], repository.root)).stdout, DESIRED_TEXT);
        assert.equal(await readFile(path.join(repository.working, 'local-note.txt'), 'utf8'), 'локальная заметка\n');
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('символическая ссылка вместо активного JSON блокируется самим слоем Git', async () => {
    const repository = await createTemporaryRepository();
    try {
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async () => {
                await rm(path.join(repository.working, TARGET_JSON));
                await symlink('../local-data.json', path.join(repository.working, TARGET_JSON));
                return [makeResult(true)];
            },
        }), /изменение типа|обычный файл/);
        assert.equal(await remoteBranchSha(repository), '');
        assert.deepEqual(github.calls, []);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('изменение дерева хуком коммита обнаруживается до отправки', async () => {
    const repository = await createTemporaryRepository();
    try {
        const hookPath = path.join(repository.working, '.git', 'hooks', 'pre-commit');
        await writeFile(hookPath, '#!/bin/sh\ngit update-index --chmod=+x -- styles/colors_example.json\n', 'utf8');
        await chmod(hookPath, 0o755);
        const github = makeGithubRecorder();
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, true),
        }), /дерево коммита отличается/);
        assert.equal(await remoteBranchSha(repository), '');
        assert.deepEqual(github.calls, ['list']);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('после сбоя создания PR следующий реальный Git-запуск восстанавливает реквест без нового push', async () => {
    const repository = await createTemporaryRepository();
    try {
        const exec = makeActionsExec(repository.working);
        const context = makeContext(repository.sha);
        const failedGithub = {
            rest: {
                pulls: {
                    async list() { return { data: [] }; },
                    async create() { throw new Error('GitHub API временно недоступен'); },
                    async update() { assert.fail('update не должен вызываться'); },
                },
            },
        };

        await assert.rejects(runGithubAction({
            github: failedGithub,
            context,
            exec,
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, true),
        }), /GitHub API временно недоступен/);

        const firstRemoteSha = (await runRequired(
            'git',
            ['ls-remote', '--heads', 'origin', `refs/heads/${TARGET_BRANCH}`],
            repository.working,
        )).stdout.split(/\s+/)[0];
        assert.ok(firstRemoteSha);

        let createCalls = 0;
        const recoveredGithub = {
            rest: {
                pulls: {
                    async list() { return { data: [] }; },
                    async create() { createCalls += 1; },
                    async update() { assert.fail('update не должен вызываться'); },
                },
            },
        };
        const result = await runGithubAction({
            github: recoveredGithub,
            context,
            exec,
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, DESIRED_TEXT, true),
        });

        const secondRemoteSha = (await runRequired(
            'git',
            ['ls-remote', '--heads', 'origin', `refs/heads/${TARGET_BRANCH}`],
            repository.working,
        )).stdout.split(/\s+/)[0];
        assert.equal(result.changed, true);
        assert.equal(result.pushed, false);
        assert.equal(createCalls, 1);
        assert.equal(secondRemoteSha, firstRemoteSha);
        assert.equal(await readFile(path.join(repository.working, TARGET_JSON), 'utf8'), DESIRED_TEXT);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('посторонний файл в реальной служебной ветке блокирует экшен до GitHub API', async () => {
    const repository = await createTemporaryRepository();
    try {
        await runRequired('git', ['checkout', '-b', TARGET_BRANCH], repository.seed);
        await writeFile(path.join(repository.seed, 'README.md'), 'постороннее изменение\n', 'utf8');
        await runRequired('git', ['add', 'README.md'], repository.seed);
        await runRequired('git', ['commit', '-m', 'постороннее изменение'], repository.seed);
        await runRequired('git', ['push', 'origin', TARGET_BRANCH], repository.seed);

        let githubCalls = 0;
        const github = {
            rest: {
                pulls: {
                    async list() { githubCalls += 1; return { data: [] }; },
                    async create() { githubCalls += 1; },
                    async update() { githubCalls += 1; },
                },
            },
        };
        await assert.rejects(runGithubAction({
            github,
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: makeSynchronizer(repository.working, BASE_TEXT, false),
        }), /служебная ветка содержит посторонний файл README\.md/);
        assert.equal(githubCalls, 0);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});

test('исчезнувшая страница реально возвращает служебную ветку к основной', async () => {
    const repository = await createTemporaryRepository();
    try {
        await runRequired('git', ['checkout', '-b', TARGET_BRANCH], repository.seed);
        await writeFile(path.join(repository.seed, TARGET_JSON), DESIRED_TEXT, 'utf8');
        await runRequired('git', ['add', '--', TARGET_JSON], repository.seed);
        await runRequired('git', ['commit', '-m', 'ожидающее изменение палитры'], repository.seed);
        await runRequired('git', ['push', 'origin', TARGET_BRANCH], repository.seed);

        let createCalls = 0;
        let updateCalls = 0;
        const result = await runGithubAction({
            github: {
                rest: {
                    pulls: {
                        async list() { return { data: [] }; },
                        async create() { createCalls += 1; },
                        async update() { updateCalls += 1; },
                    },
                },
            },
            context: makeContext(repository.sha),
            exec: makeActionsExec(repository.working),
            environment: { GITHUB_WORKSPACE: repository.working, FIGMA_TOKEN: 'тестовый-секрет' },
            discover: async () => [EXAMPLE_PALETTE],
            synchronize: async () => [],
        });

        const remoteText = (await runRequired('git', [
            '--git-dir', repository.remote,
            'show', `refs/heads/${TARGET_BRANCH}:${TARGET_JSON}`,
        ], repository.root)).stdout;
        assert.equal(result.changed, false);
        assert.equal(result.pushed, true);
        assert.deepEqual(result.revertedPaths, [TARGET_JSON]);
        assert.equal(remoteText, BASE_TEXT);
        assert.equal(createCalls, 0);
        assert.equal(updateCalls, 0);
    } finally {
        await rm(repository.root, { recursive: true, force: true });
    }
});
