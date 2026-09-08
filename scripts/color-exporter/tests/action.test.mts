import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import run, { TARGET_BRANCH, type Context } from '../src/action.mjs';
import { document, page, temporary } from './fixtures.mjs';

const target = 'styles/colors_example.json';
async function repository(t: TestContext, pending?: Record<string, string>) {
    const repoRoot = await temporary(t);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
    const origin = path.join(repoRoot, '..', 'origin.git');
    git('init', '--bare', origin);
    git('init', '--initial-branch=master');
    git('config', 'user.name', 'Тест');
    git('config', 'user.email', 'test@example.com');
    git('remote', 'add', 'origin', origin);
    const save = async (files: Record<string, string>, branch = 'master') => {
        for (const [name, text] of Object.entries(files)) await writeFile(path.join(repoRoot, name), text);
        git('add', '.');
        git('commit', '-m', 'данные проверки');
        git('push', 'origin', branch);
    };
    await save({ [target]: '{}\n' });
    const context: Context = { sha: git('rev-parse', 'HEAD').trim(), ref: 'refs/heads/master',
        repo: { owner: 'core-ds', repo: 'ui-primitives' }, payload: { repository: { default_branch: 'master' } } };
    const state = { calls: [] as string[], open: [] as { number: number }[], fail: false };
    const github = { rest: { pulls: {
        async list() { state.calls.push('list'); return { data: state.open }; },
        async create() { state.calls.push('create'); if (state.fail) throw new Error('сбой создания реквеста'); },
        async update() { state.calls.push('update'); },
    } } };
    const options = { github, context, repoRoot, token: 'тест', source: async () => document(page()) };
    const remoteSha = () => git('ls-remote', '--heads', 'origin', `refs/heads/${TARGET_BRANCH}`).split(/\s/)[0];
    if (pending) {
        git('checkout', '-b', TARGET_BRANCH);
        await save(pending, TARGET_BRANCH);
    }
    return { git, save, state, options, remoteSha };
}

test('после сбоя создания реквеста повтор создаёт его без изменения SHA, затем обновляет', async t => {
    const { state, options, remoteSha } = await repository(t);
    state.fail = true;
    await assert.rejects(run(options), /сбой создания реквеста/);
    const first = remoteSha();
    assert.match(first!, /^[0-9a-f]{40}$/);
    state.fail = false;
    const repeated = await run(options);
    assert.equal(repeated.pushed, false);
    assert.equal(repeated.changed, true);
    assert.equal(remoteSha(), first);
    state.open = [{ number: 17 }];
    await run(options);
    assert.deepEqual(state.calls, ['list', 'create', 'list', 'create', 'list', 'update']);
});
test('исчезновение страниц возвращает старый JSON, удаляет новый и отправляет согласование без реквеста', async t => {
    const added = 'styles/colors_new.json';
    const { git, state, options, remoteSha } = await repository(t, { [target]: 'ожидающее изменение\n', [added]: '{}\n' });
    const before = remoteSha();
    state.open = [{ number: 17 }];
    const result = await run({ ...options, source: async () => document() });
    assert.equal(result.changed, false);
    assert.equal(result.pushed, true);
    assert.equal(result.stalePullRequest, true);
    assert.notEqual(remoteSha(), before);
    assert.deepEqual(result.revertedPaths.sort(), [target, added].sort());
    assert.equal(git('diff', '--name-only', options.context.sha, 'HEAD'), '');
    assert.equal(await readFile(path.join(options.repoRoot, target), 'utf8'), '{}\n');
    await assert.rejects(readFile(path.join(options.repoRoot, added)), { code: 'ENOENT' });
    assert.deepEqual(state.calls, ['list']);
});
test('не отправлять изменения вне синхронизируемых палитр', async t => {
    const { state, options, remoteSha } = await repository(t, { 'README.md': 'постороннее изменение\n' });
    const before = remoteSha();
    await assert.rejects(run(options), /посторонний файл/);
    assert.equal(remoteSha(), before);
    assert.deepEqual(state.calls, []);
});
test('новая основа отправляется обычным слиянием даже при пустом индексе', async t => {
    const { git, save, state, options } = await repository(t);
    await run(options);
    git('checkout', 'master');
    await chmod(path.join(options.repoRoot, target), 0o755);
    await save({ 'README.md': 'новая основа\n' });
    options.context.sha = git('rev-parse', 'HEAD').trim();
    state.open = [{ number: 17 }];
    const result = await run(options);
    assert.deepEqual(result.stagedPaths, []);
    assert.equal(result.pushed, true);
    git('merge-base', '--is-ancestor', options.context.sha, 'HEAD');
    assert.equal(git('ls-tree', '--format=%(objectmode)', 'HEAD', '--', target).trim(), '100755');
    assert.equal(state.calls.at(-1), 'update');
});
test('изменённое хуком дерево коммита не отправляется', async t => {
    const { state, options, remoteSha } = await repository(t);
    await writeFile(path.join(options.repoRoot, '.git/hooks/pre-commit'),
        '#!/bin/sh\ngit update-index --chmod=+x -- styles/colors_example.json\n', { mode: 0o755 });
    await assert.rejects(run(options), /дерево коммита отличается/);
    assert.equal(remoteSha(), '');
    assert.deepEqual(state.calls, ['list']);
});

test('ошибка последней страницы запрещает запись и согласование исчезнувших страниц', async t => {
    const { state, options, remoteSha } = await repository(t, { 'styles/colors_absent.json': '{}\n' });
    const before = remoteSha();
    const source = async () => document(page(), page('colors_z.json', []));
    await assert.rejects(run({ ...options, source }), /нет дочерних узлов/);
    assert.equal(await readFile(path.join(options.repoRoot, target), 'utf8'), '{}\n');
    assert.equal(await readFile(path.join(options.repoRoot, 'styles/colors_absent.json'), 'utf8'), '{}\n');
    assert.equal(remoteSha(), before);
    assert.deepEqual(state.calls, []);
});

test('неверный контекст и дубли реквестов останавливают публикацию', async t => {
    const { options, remoteSha } = await repository(t);
    for (const context of [{ ...options.context, sha: 'short' }, { ...options.context, ref: 'refs/heads/other' }, { ...options.context, repo: { owner: 'other', repo: 'other' } }]) await assert.rejects(run({ ...options, context }));
    await assert.rejects(run({ ...options, token: '' }), /FIGMA_TOKEN/);
    for (const data of [[{ number: 1 }, { number: 2 }], [{ number: -1 }]]) {
        const pulls = { ...options.github.rest.pulls, list: async () => ({ data }) };
        await assert.rejects(run({ ...options, github: { rest: { pulls } } }), /GitHub|номера/);
        assert.equal(remoteSha(), '');
    }
});
