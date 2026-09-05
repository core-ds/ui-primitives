import assert from 'node:assert/strict';
import test from 'node:test';

import {
    TARGET_BRANCH,
    checkoutTargetBranch,
    inspectBranchTree,
    readPaletteBaseline,
    readPaletteBaselines,
    restoreInactivePaletteFiles,
    stagePaletteFiles,
} from '../src/action/git-operations.mjs';
import { makePullRequestBody } from '../src/action/pull-request-body.mjs';
import runGithubAction from '../src/action/run-github-action.mjs';
import { createDefaultOnlyPalette } from '../src/palettes/_create-default-only.mjs';
import type { ActionsExec, GithubContext } from '../src/action/types.mjs';
import type { PaletteRunResult } from '../src/core/types.mjs';

const TARGET_JSON = 'styles/colors_example.json';
const EXAMPLE_PALETTE = createDefaultOnlyPalette({
    id: 'example',
    label: 'Example',
    description: 'Тестовая палитра',
    pageName: 'colors_example.json',
    sectionPattern: /^static_example$/,
}).palette;
const ZETA_PALETTE = createDefaultOnlyPalette({
    id: 'zeta',
    label: 'Zeta',
    description: 'Вторая тестовая палитра',
    pageName: 'colors_zeta.json',
    sectionPattern: /^static_zeta$/,
}).palette;

function makeResult({
    paletteId = 'example',
    targetJson = TARGET_JSON,
    changed = false,
    newlyDeprecatedTokenKeys = [],
}: {
    paletteId?: string;
    targetJson?: string;
    changed?: boolean;
    newlyDeprecatedTokenKeys?: string[];
} = {}): PaletteRunResult {
    return {
        paletteId,
        targetJson,
        changed,
        changes: {
            newTokenKeys: [],
            restoredTokenKeys: [],
            changedActiveTokenKeys: [],
            newlyDeprecatedTokenKeys,
        },
        summary: {
            sections: 1,
            frames: 2,
            rectangles: 2,
            placeholders: 0,
            tokens: 2,
            oldTokens: 2 + newlyDeprecatedTokenKeys.length,
            resultTokens: 2 + newlyDeprecatedTokenKeys.length,
            activeTokens: 2,
            deprecatedTokens: newlyDeprecatedTokenKeys.length,
            newTokens: 0,
            restoredTokens: 0,
            changedActiveTokens: 0,
            newlyDeprecatedTokens: newlyDeprecatedTokenKeys.length,
        },
    };
}

function makeContext(): GithubContext {
    return {
        payload: { repository: { default_branch: 'master' } },
        ref: 'refs/heads/master',
        repo: { owner: 'core-ds', repo: 'ui-primitives' },
        sha: 'a'.repeat(40),
    };
}

interface MockExecOptions {
    branchExitCode?: number;
    stagedPaths?: string[];
    branchPaths?: string[];
    paletteDiffPaths?: string[];
    baselineText?: string;
    baselinePaths?: string[];
}

interface MockExec extends ActionsExec {
    commands: Array<[string, string[]]>;
}

function makeExec({
    branchExitCode = 2,
    stagedPaths = [],
    branchPaths = [],
    paletteDiffPaths = branchPaths,
    baselineText = '{}\n',
    baselinePaths = [TARGET_JSON],
}: MockExecOptions = {}): MockExec {
    const commands: Array<[string, string[]]> = [];
    return {
        commands,
        async exec(command: string, argumentsList: string[] = []) {
            commands.push([command, argumentsList]);
            return 0;
        },
        async getExecOutput(command: string, argumentsList: string[] = []) {
            commands.push([command, argumentsList]);
            if (argumentsList[0] === 'ls-remote') {
                return { exitCode: branchExitCode, stdout: '' };
            }
            if (argumentsList[0] === 'show') {
                return { exitCode: 0, stdout: baselineText };
            }
            if (argumentsList[0] === 'ls-tree') {
                const targetPath = argumentsList.at(-1);
                return {
                    exitCode: 0,
                    stdout: targetPath !== undefined && baselinePaths.includes(targetPath)
                        ? `100644 blob ${'c'.repeat(40)}\t${targetPath}\0`
                        : '',
                };
            }
            if (argumentsList[0] === 'ls-files') {
                const targets = argumentsList.slice(argumentsList.indexOf('--') + 1);
                return { exitCode: 0, stdout: targets.map((target) => `100644 ${'c'.repeat(40)} 0\t${target}\0`).join('') };
            }
            if (argumentsList[0] === 'diff' && argumentsList.includes('--raw')) {
                return { exitCode: 0, stdout: branchPaths.map((target) => (
                    `:100644 100644 ${'c'.repeat(40)} ${'d'.repeat(40)} M\0${target}\0`
                )).join('') };
            }
            if (argumentsList[0] === 'diff' && argumentsList.includes('--name-only')) {
                const paths = argumentsList.at(-1) === 'styles' ? paletteDiffPaths : stagedPaths;
                return { exitCode: 0, stdout: `${paths.join('\0')}${paths.length > 0 ? '\0' : ''}` };
            }
            if (argumentsList[0] === 'write-tree' || argumentsList[1] === 'HEAD^{tree}') {
                return { exitCode: 0, stdout: `${'b'.repeat(40)}\n` };
            }
            if (argumentsList[0] === 'rev-parse') {
                return { exitCode: 0, stdout: `${'a'.repeat(40)}\n${'a'.repeat(40)}\n` };
            }
            throw new Error(`неожиданный вызов: ${command} ${argumentsList.join(' ')}`);
        },
    };
}

interface GithubCalls {
    list: Array<Record<string, unknown>>;
    create: Array<Record<string, unknown>>;
    update: Array<Record<string, unknown>>;
}

function makeGithub(openPullRequests: Array<{ number: number }> = []) {
    const calls: GithubCalls = { list: [], create: [], update: [] };
    return {
        calls,
        rest: {
            pulls: {
                async list(parameters: Record<string, unknown>) {
                    calls.list.push(parameters);
                    return { data: openPullRequests };
                },
                async create(parameters: Record<string, unknown>) {
                    calls.create.push(parameters);
                },
                async update(parameters: Record<string, unknown>) {
                    calls.update.push(parameters);
                },
            },
        },
    };
}

test('новая служебная ветка создаётся от точного SHA', async () => {
    const exec = makeExec({ branchExitCode: 2 });
    const context = makeContext();

    assert.deepEqual(await checkoutTargetBranch({ exec, context }), { remoteBranchExisted: false, branchAdvanced: false });
    assert.deepEqual(exec.commands.at(-1), [
        'git',
        ['checkout', '-B', TARGET_BRANCH, context.sha],
    ]);
});

test('существующая служебная ветка продолжает историю обычным merge', async () => {
    const exec = makeExec({ branchExitCode: 0 });
    const context = makeContext();

    assert.deepEqual(await checkoutTargetBranch({ exec, context }), { remoteBranchExisted: true, branchAdvanced: false });
    assert.deepEqual(exec.commands.slice(1), [
        ['git', ['fetch', 'origin', `refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}`]],
        ['git', ['checkout', '-B', TARGET_BRANCH, `refs/remotes/origin/${TARGET_BRANCH}`]],
        ['git', ['merge', context.sha, '-m', 'chore: обновить основу ветки синхронизации']],
        ['git', ['rev-parse', 'HEAD', `refs/remotes/origin/${TARGET_BRANCH}`]],
    ]);
});

test('ошибка проверки ветки не маскируется как её отсутствие', async () => {
    const exec = makeExec({ branchExitCode: 1 });

    await assert.rejects(checkoutTargetBranch({ exec, context: makeContext() }), /завершился с кодом 1/);
    assert.equal(exec.commands.length, 1);
});

test('ошибка синхронизации запрещает восстановление файлов, запись индекса и публикацию', async () => {
    const exec = makeExec({ paletteDiffPaths: [TARGET_JSON, ZETA_PALETTE.targetJson] });
    const github = makeGithub([{ number: 17 }]);
    const synchronizationError = new Error('коллизия alias accentColorX1');
    const reports: string[] = [];

    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'тест' },
        discover: async () => [EXAMPLE_PALETTE, ZETA_PALETTE],
        synchronize: async () => { throw synchronizationError; },
        report: (message) => reports.push(message),
    }), (error: unknown) => error === synchronizationError);

    const forbiddenCommands = new Set(['restore', 'rm', 'add', 'commit', 'push']);
    assert.deepEqual(exec.commands.filter(([, argumentsList]) => (
        forbiddenCommands.has(argumentsList[0] ?? '')
    )), []);
    assert.deepEqual(github.calls, { list: [], create: [], update: [] });
    assert.deepEqual(reports, []);
});

test('Git принимает только объявленные JSON в индексе и во всём дереве ветки', async () => {
    const stagedExec = makeExec({ stagedPaths: [TARGET_JSON, 'README.md'] });
    await assert.rejects(
        stagePaletteFiles({ exec: stagedExec, targetPaths: [TARGET_JSON] }),
        /в индекс неожиданно попал файл README\.md/,
    );

    const treeExec = makeExec({ branchPaths: [TARGET_JSON, 'README.md'] });
    await assert.rejects(
        inspectBranchTree({ exec: treeExec, baseSha: makeContext().sha, targetPaths: [TARGET_JSON] }),
        /служебная ветка содержит посторонний файл README\.md/,
    );
});

test('исходный JSON читается из точного SHA без потери конечного перевода строки', async () => {
    const exec = makeExec({ baselineText: '{\n}\n' });
    const baselines = await readPaletteBaselines({
        exec,
        baseSha: makeContext().sha,
        targetPaths: [TARGET_JSON],
    });
    assert.equal(baselines.get(TARGET_JSON), '{\n}\n');
});

test('отсутствующий в основной ветке JSON считается новым набором', async () => {
    const exec = makeExec({ baselinePaths: [] });
    assert.equal(await readPaletteBaseline({
        exec,
        baseSha: makeContext().sha,
        targetPath: TARGET_JSON,
    }), undefined);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'show'), false);
});

test('неактивный новый JSON удаляется, а существующий возвращается к основной ветке', async () => {
    const existingExec = makeExec({ paletteDiffPaths: [TARGET_JSON] });
    assert.deepEqual(await restoreInactivePaletteFiles({
        exec: existingExec,
        baseSha: makeContext().sha,
        activeTargetPaths: [],
    }), [TARGET_JSON]);
    assert.ok(existingExec.commands.some(([, argumentsList]) => argumentsList[0] === 'restore'));

    const newExec = makeExec({ paletteDiffPaths: [TARGET_JSON], baselinePaths: [] });
    assert.deepEqual(await restoreInactivePaletteFiles({
        exec: newExec,
        baseSha: makeContext().sha,
        activeTargetPaths: [],
    }), [TARGET_JSON]);
    assert.ok(newExec.commands.some(([, argumentsList]) => argumentsList[0] === 'rm'));
});

test('описание PR стабильно сортирует файлы и новые deprecated-ключи', () => {
    const second = makeResult({
        targetJson: 'styles/colors_zeta.json',
        changed: true,
        newlyDeprecatedTokenKeys: ['z_token', 'a_token'],
    });
    const first = makeResult({ targetJson: 'styles/colors_alpha.json' });
    const body = makePullRequestBody([second, first]);

    assert.ok(body.indexOf('colors_alpha.json') < body.indexOf('colors_zeta.json'));
    assert.ok(body.indexOf('a_token') < body.indexOf('z_token'));
    assert.match(body, /## Новые устаревшие токены/);
    assert.match(body, /2 токена помечены устаревшими/);
});

test('описание PR отклоняет расхождение счётчика и списка ключей', () => {
    const result = makeResult();
    result.summary.newTokens = 1;

    assert.throws(
        () => makePullRequestBody([result]),
        /summary\.newTokens не совпадает с changes\.newTokenKeys/,
    );
});

test('русские формы числительных в описании PR не зависят от ручного текста', () => {
    const bodies = [1, 2, 5, 11, 21, 22, 25].map((count) => makePullRequestBody([makeResult({
        changed: true,
        newlyDeprecatedTokenKeys: Array.from({ length: count }, (_value, index) => `token_${index}`),
    })]));

    assert.match(bodies[0] ?? '', /1 токен помечен устаревшим/);
    assert.match(bodies[1] ?? '', /2 токена помечены устаревшими/);
    assert.match(bodies[2] ?? '', /5 токенов помечено устаревшими/);
    assert.match(bodies[3] ?? '', /11 токенов помечено устаревшими/);
    assert.match(bodies[4] ?? '', /21 токен помечен устаревшим/);
    assert.match(bodies[5] ?? '', /22 токена помечены устаревшими/);
    assert.match(bodies[6] ?? '', /25 токенов помечено устаревшими/);
});

test('описание PR перечисляет новые, восстановленные и изменённые активные токены', () => {
    const result = makeResult({ changed: true });
    result.changes = {
        newTokenKeys: ['new_token'],
        restoredTokenKeys: ['restored_token'],
        changedActiveTokenKeys: ['changed_token'],
        newlyDeprecatedTokenKeys: [],
    };
    result.summary = {
        ...result.summary,
        frames: 4,
        rectangles: 4,
        tokens: 4,
        oldTokens: 3,
        resultTokens: 4,
        activeTokens: 4,
        newTokens: 1,
        restoredTokens: 1,
        changedActiveTokens: 1,
    };

    const body = makePullRequestBody([result]);
    assert.match(body, /1 новый токен/);
    assert.match(body, /1 токен возвращён из устаревших/);
    assert.match(body, /1 активный токен обновлён/);
});

test('пустое дерево не создаёт commit или push и явно сообщает об устаревшем PR', async () => {
    const exec = makeExec();
    const github = makeGithub([{ number: 17 }]);
    const result = makeResult();

    const actionResult = await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [result],
    });

    assert.equal(actionResult.changed, false);
    assert.equal(actionResult.stalePullRequest, true);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'commit'), false);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'push'), false);
    assert.equal(github.calls.list.length, 1);
    assert.equal(github.calls.create.length, 0);
    assert.equal(github.calls.update.length, 0);
});

test('исчезнувшая страница согласует служебную ветку без создания нового реквеста', async () => {
    const exec = makeExec({
        paletteDiffPaths: [TARGET_JSON],
        branchPaths: [],
        stagedPaths: [TARGET_JSON],
    });
    const github = makeGithub([{ number: 17 }]);
    const reports: string[] = [];

    const actionResult = await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [],
        report: (message) => reports.push(message),
    });

    assert.equal(actionResult.changed, false);
    assert.equal(actionResult.pushed, true);
    assert.equal(actionResult.stalePullRequest, true);
    assert.deepEqual(actionResult.revertedPaths, [TARGET_JSON]);
    assert.deepEqual(actionResult.inactiveConfiguredPages, [{
        paletteId: 'example',
        pageName: 'colors_example.json',
        targetJson: TARGET_JSON,
    }]);
    assert.deepEqual(reports, [
        'Настроенные особые страницы без источника Figma: example: colors_example.json → styles/colors_example.json.',
        'Реквест #17 устарел: разницы с основной веткой нет. Проверьте и закройте его вручную.',
    ]);
    assert.ok(exec.commands.some(([, argumentsList]) => argumentsList.includes('chore: согласовать отключённые цвета')));
    assert.equal(github.calls.create.length, 0);
    assert.equal(github.calls.update.length, 0);
});

test('несколько отсутствующих особых страниц перечисляются в стабильном порядке', async () => {
    const reports: string[] = [];
    const actionResult = await runGithubAction({
        github: makeGithub(),
        context: makeContext(),
        exec: makeExec(),
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [ZETA_PALETTE, EXAMPLE_PALETTE],
        synchronize: async () => [],
        report: (message) => reports.push(message),
    });

    assert.deepEqual(
        actionResult.inactiveConfiguredPages.map((page) => page.targetJson),
        [TARGET_JSON, 'styles/colors_zeta.json'],
    );
    assert.deepEqual(reports, [
        'Настроенные особые страницы без источника Figma: '
            + 'example: colors_example.json → styles/colors_example.json, '
            + 'zeta: colors_zeta.json → styles/colors_zeta.json.',
    ]);
});

test('изменение создаёт коммит, обычный push и новый PR', async () => {
    const exec = makeExec({ stagedPaths: [TARGET_JSON], branchPaths: [TARGET_JSON] });
    const github = makeGithub();
    const result = makeResult({ changed: true });
    const reports: string[] = [];

    const actionResult = await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async (options) => {
            assert.equal(typeof options.createPaletteForPage, 'function');
            assert.equal(await options.loadBaselineJsonText?.(TARGET_JSON), '{}\n');
            return [result];
        },
        report: (message) => reports.push(message),
    });

    assert.equal(actionResult.changed, true);
    assert.equal(actionResult.pushed, true);
    assert.deepEqual(actionResult.stagedPaths, [TARGET_JSON]);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'commit'), true);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'push'), true);
    assert.equal(github.calls.create.length, 1);
    assert.equal(github.calls.update.length, 0);
    assert.equal(github.calls.create[0]?.head, TARGET_BRANCH);
    assert.equal(github.calls.create[0]?.base, 'master');
    assert.deepEqual(actionResult.inactiveConfiguredPages, []);
    assert.deepEqual(reports, ['Настроенные особые страницы без источника Figma: нет.']);
});

test('результат новой стандартной страницы принимается без явного модуля', async () => {
    const newTarget = 'styles/colors_new_palette.json';
    const exec = makeExec({ stagedPaths: [newTarget], branchPaths: [newTarget] });
    const github = makeGithub();

    const actionResult = await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({
            paletteId: 'new-palette',
            targetJson: newTarget,
            changed: true,
        })],
    });

    assert.equal(actionResult.changed, true);
    assert.deepEqual(actionResult.branchPaths, [newTarget]);
    assert.equal(github.calls.create.length, 1);
});

test('несколько результатов обязаны идти в стабильном порядке целевых путей', async () => {
    const newResult = makeResult({
        paletteId: 'new-palette',
        targetJson: 'styles/colors_new_palette.json',
    });
    const exampleResult = makeResult();
    const common = {
        github: makeGithub(),
        context: makeContext(),
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
    };

    const accepted = await runGithubAction({
        ...common,
        exec: makeExec(),
        synchronize: async () => [exampleResult, newResult],
    });
    assert.deepEqual(accepted.results.map((result) => result.targetJson), [
        TARGET_JSON,
        'styles/colors_new_palette.json',
    ]);

    await assert.rejects(runGithubAction({
        ...common,
        exec: makeExec(),
        synchronize: async () => [newResult, exampleResult],
    }), /нестабильном порядке/);
});

test('после прошлого push реквест восстанавливается без нового commit и push', async () => {
    const exec = makeExec({ stagedPaths: [], branchPaths: [TARGET_JSON] });
    const github = makeGithub();

    const actionResult = await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({ changed: true })],
    });

    assert.equal(actionResult.changed, true);
    assert.equal(actionResult.pushed, false);
    assert.equal(github.calls.create.length, 1);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'commit'), false);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'push'), false);
});

test('единственный открытый PR обновляется без создания дубля', async () => {
    const exec = makeExec({ stagedPaths: [TARGET_JSON], branchPaths: [TARGET_JSON] });
    const github = makeGithub([{ number: 17 }]);

    await runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({ changed: true })],
    });

    assert.equal(github.calls.create.length, 0);
    assert.equal(github.calls.update.length, 1);
    assert.equal(github.calls.update[0]?.pull_number, 17);
    assert.equal(Object.hasOwn(github.calls.update[0] ?? {}, 'head'), false);
    assert.equal(Object.hasOwn(github.calls.update[0] ?? {}, 'base'), false);
});

test('два открытых PR останавливают экшен до commit и push', async () => {
    const exec = makeExec({ stagedPaths: [TARGET_JSON], branchPaths: [TARGET_JSON] });
    const github = makeGithub([{ number: 1 }, { number: 2 }]);

    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({ changed: true })],
    }), /найдено несколько открытых PR/);

    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'commit'), false);
    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'push'), false);
});

test('неправильный номер открытого реквеста останавливает экшен до коммита и отправки', async () => {
    const exec = makeExec({ stagedPaths: [TARGET_JSON], branchPaths: [TARGET_JSON] });
    const github = makeGithub([{ number: 0 }]);
    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({ changed: true })],
    }), /нет правильного номера/);
    assert.equal(exec.commands.some(([, argumentsList]) => ['commit', 'push'].includes(argumentsList[0] ?? '')), false);
    assert.deepEqual(github.calls.create, []);
    assert.deepEqual(github.calls.update, []);
});

test('каждый изменённый результат должен присутствовать в итоговом индексе', async () => {
    const exec = makeExec();
    const github = makeGithub();
    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [makeResult({ changed: true })],
    }), /не совпадающий с разницей/);
    assert.equal(exec.commands.some(([, argumentsList]) => ['commit', 'push'].includes(argumentsList[0] ?? '')), false);
    assert.deepEqual(github.calls.create, []);
});

test('несогласованный результат синхронизации останавливает экшен до индекса и GitHub API', async () => {
    const exec = makeExec();
    const github = makeGithub();
    const wrongResult = makeResult();
    wrongResult.paletteId = 'другая-палитра';

    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        discover: async () => [EXAMPLE_PALETTE],
        synchronize: async () => [wrongResult],
    }), /несогласованный результат/);

    assert.equal(exec.commands.some(([, argumentsList]) => argumentsList[0] === 'add'), false);
    assert.equal(github.calls.list.length, 0);
});

test('чужой репозиторий, неправильный SHA, неосновная ветка и отсутствующий секрет отклоняются до команд Git', async () => {
    const github = makeGithub();
    const wrongRepositoryContext = makeContext();
    wrongRepositoryContext.repo = { owner: 'example', repo: 'ui-primitives' };
    const wrongRepositoryExec = makeExec();

    await assert.rejects(runGithubAction({
        github,
        context: wrongRepositoryContext,
        exec: wrongRepositoryExec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
    }), /экспорт разрешён только в core-ds\/ui-primitives/);
    assert.deepEqual(wrongRepositoryExec.commands, []);

    const wrongShaContext = makeContext();
    wrongShaContext.sha = 'main';
    const wrongShaExec = makeExec();
    await assert.rejects(runGithubAction({
        github,
        context: wrongShaContext,
        exec: wrongShaExec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
    }), /context\.sha должен быть полным Git SHA/);
    assert.deepEqual(wrongShaExec.commands, []);

    for (const length of [39, 41, 63, 65]) {
        const exec = makeExec();
        const context = { ...makeContext(), sha: 'a'.repeat(length) };
        await assert.rejects(runGithubAction({
            github,
            context,
            exec,
            environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
        }), /context\.sha должен быть полным Git SHA/);
        assert.deepEqual(exec.commands, []);
    }

    const context = makeContext();
    context.ref = 'refs/heads/feature';
    const wrongBranchExec = makeExec();

    await assert.rejects(runGithubAction({
        github,
        context,
        exec: wrongBranchExec,
        environment: { GITHUB_WORKSPACE: '/repo', FIGMA_TOKEN: 'секрет' },
    }), /экспорт разрешён только из основной ветки master/);
    assert.deepEqual(wrongBranchExec.commands, []);

    const missingSecretExec = makeExec();
    await assert.rejects(runGithubAction({
        github,
        context: makeContext(),
        exec: missingSecretExec,
        environment: { GITHUB_WORKSPACE: '/repo' },
    }), /FIGMA_TOKEN не задан/);
    assert.deepEqual(missingSecretExec.commands, []);
});
