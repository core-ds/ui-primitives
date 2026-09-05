import { invariant } from '../core/assertions.mjs';
import { compareCodeUnits } from '../core/stable-order.mjs';
import type { ActionsExec, GithubContext } from './types.mjs';

export const TARGET_BRANCH = 'feat/update-colors';

function assertBranchName(branchName: string): void {
    invariant(
        typeof branchName === 'string'
            && /^[a-z0-9][a-z0-9._/-]*$/.test(branchName)
            && !branchName.includes('..')
            && !branchName.includes('//')
            && !branchName.endsWith('/')
            && !branchName.endsWith('.')
            && !branchName.endsWith('.lock'),
        `недопустимое имя служебной ветки ${String(branchName)}`,
    );
}

export function makePushArguments(targetBranch = TARGET_BRANCH): string[] {
    assertBranchName(targetBranch);
    return ['push', 'origin', `HEAD:${targetBranch}`];
}

/**
 * Готовит постоянную служебную ветку без принудительной перезаписи истории.
 * Код 2 у `git ls-remote --exit-code` означает отсутствие ветки. Любая
 * сетевая или авторизационная ошибка остаётся ошибкой и не маскируется.
 */
interface CheckoutTargetBranchOptions {
    exec: ActionsExec;
    context: GithubContext;
    targetBranch?: string;
}

export async function checkoutTargetBranch({
    exec,
    context,
    targetBranch = TARGET_BRANCH,
}: CheckoutTargetBranchOptions): Promise<{ remoteBranchExisted: boolean; branchAdvanced: boolean }> {
    assertBranchName(targetBranch);
    invariant(isFullSha(context.sha), 'context.sha должен быть полным Git SHA');

    const remoteReference = `refs/heads/${targetBranch}`;
    const lookup = await exec.getExecOutput(
        'git',
        ['ls-remote', '--exit-code', '--heads', 'origin', remoteReference],
        { ignoreReturnCode: true, silent: true },
    );

    if (lookup.exitCode === 2) {
        await exec.exec('git', ['checkout', '-B', targetBranch, context.sha]);
        return { remoteBranchExisted: false, branchAdvanced: false };
    }
    invariant(
        lookup.exitCode === 0,
        `не удалось проверить служебную ветку ${targetBranch}: git завершился с кодом ${lookup.exitCode}`,
    );

    const localRemoteReference = `refs/remotes/origin/${targetBranch}`;
    await exec.exec('git', ['fetch', 'origin', `${remoteReference}:${localRemoteReference}`]);
    await exec.exec('git', ['checkout', '-B', targetBranch, localRemoteReference]);
    await exec.exec('git', [
        'merge',
        context.sha,
        '-m',
        'chore: обновить основу ветки синхронизации',
    ]);
    const revisions = await exec.getExecOutput('git', ['rev-parse', 'HEAD', localRemoteReference]);
    const [headSha, remoteSha] = revisions.stdout.trimEnd().split('\n');
    invariant(
        revisions.exitCode === 0 && isFullSha(headSha) && isFullSha(remoteSha),
        'не удалось сравнить локальную и удалённую служебную ветку',
    );
    return { remoteBranchExisted: true, branchAdvanced: headSha !== remoteSha };
}

function validateTargetPaths(
    targetPaths: readonly string[],
    { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Set<string> {
    invariant(
        Array.isArray(targetPaths) && (allowEmpty || targetPaths.length > 0),
        'не указаны JSON для операции Git',
    );
    const uniqueTargets = new Set(targetPaths);
    invariant(uniqueTargets.size === targetPaths.length, 'список JSON для Git содержит повторы');
    for (const targetPath of targetPaths) {
        invariant(
            /^styles\/colors_[a-z0-9_]+\.json$/.test(targetPath),
            `недопустимый путь палитры ${targetPath}`,
        );
    }
    return uniqueTargets;
}

function isFullSha(value: unknown): value is string {
    return typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
}

function nullSeparatedFields(output: string): string[] {
    if (output.length === 0) return [];
    invariant(output.endsWith('\0'), 'Git вернул список без конечного нулевого разделителя');
    return output.slice(0, -1).split('\0');
}

function assertRegularMode(mode: string, targetPath: string): void {
    invariant(mode === '100644' || mode === '100755', `${targetPath}: Git ожидает обычный файл, получен режим ${mode}`);
}

async function inspectIndexedFiles(exec: ActionsExec, targetPaths: readonly string[]): Promise<void> {
    if (targetPaths.length === 0) return;
    const output = await exec.getExecOutput('git', ['ls-files', '--stage', '-z', '--', ...targetPaths]);
    invariant(output.exitCode === 0, 'не удалось проверить файлы в индексе Git');
    const missingPaths = new Set(targetPaths);
    for (const entry of nullSeparatedFields(output.stdout)) {
        const match = /^([0-7]{6}) ([0-9a-f]+) ([0-3])\t(.+)$/.exec(entry);
        invariant(match && isFullSha(match[2]), 'Git вернул неправильную запись индекса');
        const [, mode, , stage, targetPath] = match;
        invariant(targetPath !== undefined && missingPaths.delete(targetPath), `неожиданный или повторный путь в индексе ${String(targetPath)}`);
        invariant(stage === '0', `${targetPath}: в индексе остался конфликт`);
        assertRegularMode(mode ?? '', targetPath);
    }
    invariant(missingPaths.size === 0, `в индексе отсутствуют активные JSON: ${[...missingPaths].join(', ')}`);
}

/** Добавляет, изменяет или удаляет только объявленные JSON. */
export async function stagePaletteFiles({
    exec,
    targetPaths,
    restoredPaths = [],
}: {
    exec: ActionsExec;
    targetPaths: string[];
    restoredPaths?: string[];
}): Promise<string[]> {
    const uniqueTargets = validateTargetPaths([...targetPaths, ...restoredPaths], { allowEmpty: true });

    // Восстановление уже подготовило индекс, в том числе удалённые пути.
    // Повторный git add для удалённого через git rm файла завершился бы ошибкой.
    if (targetPaths.length > 0) await exec.exec('git', ['add', '-A', '--', ...targetPaths]);
    await exec.exec('git', ['diff', '--cached', '--check']);
    const staged = await exec.getExecOutput('git', ['diff', '--cached', '--name-only', '--no-renames', '-z']);
    invariant(staged.exitCode === 0, 'не удалось проверить список подготовленных файлов');
    const stagedPaths = nullSeparatedFields(staged.stdout).sort(compareCodeUnits);

    for (const stagedPath of stagedPaths) {
        invariant(uniqueTargets.has(stagedPath), `в индекс неожиданно попал файл ${stagedPath}`);
    }
    return stagedPaths;
}

/**
 * Читает один JSON прямо из конкретного коммита основной ветки.
 * Отсутствие пути — нормальный результат для страницы, добавленной впервые.
 */
export async function readPaletteBaseline({
    exec,
    baseSha,
    targetPath,
}: {
    exec: ActionsExec;
    baseSha: string;
    targetPath: string;
}): Promise<string | undefined> {
    invariant(isFullSha(baseSha), 'baseSha должен быть полным Git SHA');
    validateTargetPaths([targetPath]);

    const lookup = await exec.getExecOutput(
        'git',
        ['ls-tree', '-z', baseSha, '--', targetPath],
        { ignoreReturnCode: true, silent: true },
    );
    invariant(
        lookup.exitCode === 0,
        `не удалось проверить ${targetPath} в основной ветке: git завершился с кодом ${lookup.exitCode}`,
    );
    if (lookup.stdout.length === 0) return undefined;
    const entries = nullSeparatedFields(lookup.stdout);
    const entry = /^([0-7]{6}) blob ([0-9a-f]+)\t(.+)$/.exec(entries[0] ?? '');
    invariant(entries.length === 1 && entry && isFullSha(entry[2]) && entry[3] === targetPath, `Git вернул неожиданный путь или тип при проверке ${targetPath}`);
    assertRegularMode(entry[1] ?? '', targetPath);

    const output = await exec.getExecOutput(
        'git',
        ['show', `${baseSha}:${targetPath}`],
        { ignoreReturnCode: true, silent: true },
    );
    invariant(
        output.exitCode === 0,
        `не удалось прочитать ${targetPath} из основной ветки: git завершился с кодом ${output.exitCode}`,
    );
    return output.stdout;
}

/** Пакетная обёртка для локальных проверок и тестов. */
export async function readPaletteBaselines({
    exec,
    baseSha,
    targetPaths,
}: {
    exec: ActionsExec;
    baseSha: string;
    targetPaths: string[];
}): Promise<Map<string, string | undefined>> {
    validateTargetPaths(targetPaths);
    const entries = await Promise.all(targetPaths.map(async (targetPath) => (
        [targetPath, await readPaletteBaseline({ exec, baseSha, targetPath })] as const
    )));
    return new Map(entries);
}

/**
 * Возвращает к основной ветке изменения JSON, страницы которых исчезли из
 * Figma. Файл из основной ветки восстанавливается, а созданный только в
 * служебной ветке удаляется. Другие пути функция не трогает.
 */
export async function restoreInactivePaletteFiles({
    exec,
    baseSha,
    activeTargetPaths,
}: {
    exec: ActionsExec;
    baseSha: string;
    activeTargetPaths: string[];
}): Promise<string[]> {
    invariant(isFullSha(baseSha), 'baseSha должен быть полным Git SHA');
    const activeTargets = validateTargetPaths(activeTargetPaths, { allowEmpty: true });
    const output = await exec.getExecOutput('git', ['diff', '--cached', '--name-only', '--no-renames', '-z', baseSha, '--', 'styles']);
    invariant(output.exitCode === 0, `не удалось найти изменения палитр относительно ${baseSha}`);
    const inactiveTargets = nullSeparatedFields(output.stdout)
        .filter((changedPath) => /^styles\/colors_[a-z0-9_]+\.json$/.test(changedPath))
        .filter((changedPath) => !activeTargets.has(changedPath))
        .sort(compareCodeUnits);

    for (const targetPath of inactiveTargets) {
        const baseline = await readPaletteBaseline({ exec, baseSha, targetPath });
        if (baseline === undefined) {
            await exec.exec('git', ['rm', '--ignore-unmatch', '--', targetPath]);
        } else {
            await exec.exec('git', ['restore', `--source=${baseSha}`, '--staged', '--worktree', '--', targetPath]);
        }
    }
    return inactiveTargets;
}

/**
 * Сравнивает итоговый индекс с точным SHA основной ветки. Именно это дерево
 * попадёт в коммит; незаписанные изменения рабочей копии не могут его скрыть.
 * Любой путь вне подключённых палитр останавливает экшен до коммита и отправки.
 */
export async function inspectBranchTree({
    exec,
    baseSha,
    targetPaths,
}: {
    exec: ActionsExec;
    baseSha: string;
    targetPaths: string[];
}): Promise<string[]> {
    invariant(isFullSha(baseSha), 'baseSha должен быть полным Git SHA');
    const allowedTargets = validateTargetPaths(targetPaths, { allowEmpty: true });
    const output = await exec.getExecOutput('git', [
        'diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', baseSha, '--',
    ]);
    invariant(output.exitCode === 0, `не удалось сравнить служебную ветку с ${baseSha}`);
    const fields = nullSeparatedFields(output.stdout);
    invariant(fields.length % 2 === 0, 'Git вернул неполную разницу индекса');
    const changedPaths: string[] = [];
    for (let index = 0; index < fields.length; index += 2) {
        const changedPath = fields[index + 1];
        invariant(
            changedPath !== undefined && allowedTargets.has(changedPath),
            `служебная ветка содержит посторонний файл ${changedPath}`,
        );
        const entry = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])$/.exec(fields[index] ?? '');
        invariant(entry && isFullSha(entry[3]) && isFullSha(entry[4]), 'Git вернул неправильную разницу индекса');
        const [, oldMode, newMode, , , status] = entry;
        invariant(status === 'A' || status === 'M', `${changedPath}: запрещено удаление или изменение типа активного JSON`);
        assertRegularMode(newMode ?? '', changedPath);
        if (oldMode !== '000000') assertRegularMode(oldMode ?? '', changedPath);
        invariant(newMode === (oldMode === '000000' ? '100644' : oldMode), `${changedPath}: изменены права файла`);
        changedPaths.push(changedPath);
    }
    await inspectIndexedFiles(exec, targetPaths);
    return changedPaths.sort(compareCodeUnits);
}

/** Фиксирует точное дерево подготовленного индекса до обращения к GitHub. */
export async function readIndexTree(exec: ActionsExec): Promise<string> {
    const output = await exec.getExecOutput('git', ['write-tree']);
    const treeSha = output.stdout.trimEnd();
    invariant(output.exitCode === 0 && isFullSha(treeSha), 'не удалось зафиксировать дерево индекса');
    return treeSha;
}

/** Хуки коммита тоже не могут незаметно изменить проверенное дерево. */
export async function verifyCommittedTree(exec: ActionsExec, expectedTreeSha: string): Promise<void> {
    const output = await exec.getExecOutput('git', ['rev-parse', 'HEAD^{tree}']);
    invariant(output.exitCode === 0 && output.stdout.trimEnd() === expectedTreeSha, 'дерево коммита отличается от проверенного индекса; отправка запрещена');
}
