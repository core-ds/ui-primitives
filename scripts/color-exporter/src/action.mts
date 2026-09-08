import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fetchFigma, prepare, writePlans, type Plan } from './sync.mjs';
import { TARGET } from './contract.mjs';

export const TARGET_BRANCH = 'feat/update-colors';
type Parameters = Record<string, string | number>;
type Github = { rest: { pulls: {
    list(parameters: Parameters): Promise<{ data: unknown }>;
    create(parameters: Parameters): Promise<unknown>;
    update(parameters: Parameters): Promise<unknown>;
} } };
export type Context = {
    repo: { owner: string; repo: string }; sha: string; ref: string;
    payload: { repository?: { default_branch?: string } };
};
type Options = {
    github: Github; context: Context; repoRoot?: string; token?: string;
    source?: (token: string) => Promise<unknown>;
};
const fullSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const regular = (mode: string) => mode === '100644' || mode === '100755';
function fields(text: string): string[] {
    if (!text) return [];
    assert(text.endsWith('\0'), 'Git вернул список без конечного нулевого разделителя');
    return text.slice(0, -1).split('\0');
}
function body(plans: Plan[]): string {
    const changed = plans.filter(plan => plan.before !== plan.text);
    return [
        'Цветовые токены синхронизированы с экспортными страницами Figma REST.', '',
        ...changed.flatMap(plan => [
            `- \`${plan.path}\``,
            ...plan.deprecated.map(key => `  - Помечен устаревшим: \`${key}\``),
        ]), '',
        'Отсутствующие токены сохраняются с `deprecated: true`. Автоматическое слияние не выполняется.', '',
        '[Алгоритм](https://github.com/core-ds/ui-primitives/blob/feat/update-colors/scripts/color-exporter/README.md) · '
            + '[Формат Figma](https://github.com/core-ds/ui-primitives/blob/feat/update-colors/scripts/color-exporter/docs/FIGMA_FORMAT.md)',
    ].join('\n');
}

export default async function run({ github, context, repoRoot = process.env.GITHUB_WORKSPACE,
    token = process.env.FIGMA_TOKEN, source = fetchFigma }: Options) {
    assert(repoRoot, 'GITHUB_WORKSPACE не задан');
    assert(typeof token === 'string' && token.length > 0, 'FIGMA_TOKEN не задан');
    assert(context?.repo?.owner === 'core-ds' && context.repo.repo === 'ui-primitives',
        'экспорт разрешён только в core-ds/ui-primitives');
    assert(fullSha.test(context.sha ?? ''), 'context.sha должен быть полным Git SHA');
    const base = context.payload?.repository?.default_branch;
    assert(typeof base === 'string' && base.length > 0 && context.ref === `refs/heads/${base}`,
        'экспорт разрешён только из основной ветки репозитория');
    const pulls = github?.rest?.pulls;
    assert(['list', 'create', 'update'].every(key => typeof pulls?.[key as keyof typeof pulls] === 'function'),
        'клиент GitHub Pull Requests неполон');
    const git = (...args: string[]) => execFileSync('git', args,
        { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
    const modes = new Map<string, string>();
    const baseMode = (path: string): string => {
        assert(TARGET.test(path), `недопустимый путь палитры ${path}`);
        if (modes.has(path)) return modes.get(path)!;
        const mode = git('ls-tree', '--format=%(objectmode)', context.sha, '--', path).trim();
        assert(!mode || regular(mode), `${path}: ожидается обычный файл`);
        modes.set(path, mode);
        return mode;
    };
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    let remoteBranchExisted = true;
    try { git('ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${TARGET_BRANCH}`); }
    catch (error) {
        if ((error as { status?: number }).status !== 2) throw error;
        remoteBranchExisted = false;
    }
    const remote = `refs/remotes/origin/${TARGET_BRANCH}`;
    if (remoteBranchExisted) git('fetch', 'origin', `refs/heads/${TARGET_BRANCH}:${remote}`);
    git('checkout', '-B', TARGET_BRANCH, remoteBranchExisted ? remote : context.sha);
    if (remoteBranchExisted) git('merge', context.sha, '-m', 'chore: обновить основу ветки синхронизации');
    const branchAdvanced = remoteBranchExisted && git('rev-parse', 'HEAD') !== git('rev-parse', remote);
    const plans = await prepare(await source(token), async path =>
        baseMode(path) ? git('show', `${context.sha}:${path}`) : undefined);
    const active = new Set(plans.map(plan => plan.path));
    // Исчезнувшие страницы возвращаются к точной основе только после проверки всех палитр.
    const revertedPaths = fields(git('diff', '--cached', '--name-only', '--no-renames', '-z', context.sha))
        .filter(path => TARGET.test(path) && !active.has(path));
    await writePlans(repoRoot, plans);
    for (const path of revertedPaths) {
        if (baseMode(path)) git('restore', `--source=${context.sha}`, '--staged', '--worktree', '--', path);
        else git('rm', '--ignore-unmatch', '--', path);
    }
    if (active.size) git('add', '-A', '--', ...active);
    git('diff', '--cached', '--check');
    const stagedPaths = fields(git('diff', '--cached', '--name-only', '--no-renames', '-z'));
    const allowed = new Set([...active, ...revertedPaths]);
    for (const path of stagedPaths) assert(allowed.has(path), `в индекс попал посторонний файл ${path}`);
    const branchPaths = fields(git('diff', '--cached', '--name-only', '--no-renames', '-z', context.sha));
    for (const path of branchPaths) assert(active.has(path), `служебная ветка содержит посторонний файл ${path}`);
    if (active.size) {
        // Точное сравнение одновременно проверяет наличие, тип, права и отсутствие конфликтов.
        const actual = fields(git('ls-files', '--format=%(objectmode) %(stage) %(path)', '-z', '--', ...active));
        const expected = plans.map(plan => `${baseMode(plan.path) || '100644'} 0 ${plan.path}`);
        assert.deepEqual(actual.sort(), expected.sort(), 'в индексе изменены состав, тип или права активных палитр');
    }
    assert.deepEqual(branchPaths.sort(), plans.filter(plan => plan.before !== plan.text).map(plan => plan.path).sort(),
        'разница итогового индекса не совпадает с рассчитанными палитрами');
    const expectedTree = git('write-tree').trim();
    assert(fullSha.test(expectedTree), 'не удалось зафиксировать дерево индекса');
    const { owner, repo } = context.repo;
    const { data } = await pulls.list({ owner, repo, state: 'open', base, head: `${owner}:${TARGET_BRANCH}`, per_page: 2 });
    assert(Array.isArray(data) && data.length <= 1, 'GitHub вернул неправильный список или несколько открытых реквестов');
    const number: unknown = data[0]?.number;
    assert(data.length === 0 || (typeof number === 'number' && Number.isSafeInteger(number) && number > 0),
        'у открытого реквеста нет правильного номера');
    const changed = branchPaths.length > 0;
    const title = 'feat: обновить цвета';
    const description = body(plans);
    if (stagedPaths.length) git('commit', '-m', changed ? title : 'chore: согласовать отключённые цвета');
    const pushed = stagedPaths.length > 0 || branchAdvanced;
    if (pushed) {
        assert.equal(git('rev-parse', 'HEAD^{tree}').trim(), expectedTree,
            'дерево коммита отличается от проверенного индекса; отправка запрещена');
        git('push', 'origin', `HEAD:${TARGET_BRANCH}`);
    }
    if (changed) {
        if (typeof number === 'number') await pulls.update({ owner, repo, pull_number: number, title, body: description });
        else await pulls.create({ owner, repo, base, head: TARGET_BRANCH, title, body: description });
    } else if (number !== undefined) {
        console.info(`Реквест #${number}: разницы с основной веткой нет. Проверьте и закройте его вручную.`);
    }
    return { changed, pushed, stagedPaths, branchPaths, revertedPaths, remoteBranchExisted,
        stalePullRequest: !changed && number !== undefined, plans };
}
