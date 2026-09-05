import { invariant, isPlainObject } from '../core/assertions.mjs';
import { compareCodeUnits } from '../core/stable-order.mjs';
import type { PaletteRunResult } from '../core/types.mjs';
import { TARGET_BRANCH } from './git-operations.mjs';
import { makePullRequestBody } from './pull-request-body.mjs';

interface PublicationPlan {
    commitMessage: string | undefined;
    pushRequired: boolean;
    stalePullRequestNumber: number | undefined;
    pullRequest: { title: string; body: string; number: number | undefined } | undefined;
}

/** Все смысловые проверки и текст реквеста готовы до первой отправки. */
export function preparePublicationPlan({
    results,
    branchPaths,
    stagedPaths,
    branchAdvanced,
    openPullRequests,
}: {
    results: readonly PaletteRunResult[];
    branchPaths: readonly string[];
    stagedPaths: readonly string[];
    branchAdvanced: boolean;
    openPullRequests: unknown;
}): PublicationPlan {
    const expectedPaths = results.filter((result) => result.changed)
        .map((result) => result.targetJson).sort(compareCodeUnits);
    invariant(
        expectedPaths.join('\0') === [...branchPaths].sort(compareCodeUnits).join('\0'),
        'синхронизатор вернул результат, не совпадающий с разницей итогового индекса',
    );
    invariant(Array.isArray(openPullRequests), 'GitHub вернул неправильный список реквестов');
    invariant(openPullRequests.length <= 1, `найдено несколько открытых PR из ветки ${TARGET_BRANCH}`);
    let pullRequestNumber: number | undefined;
    if (openPullRequests.length === 1) {
        const pullRequest: unknown = openPullRequests[0];
        invariant(
            isPlainObject(pullRequest) && typeof pullRequest.number === 'number'
                && Number.isSafeInteger(pullRequest.number) && pullRequest.number > 0,
            'у открытого реквеста нет правильного номера',
        );
        pullRequestNumber = pullRequest.number;
    }
    const changed = branchPaths.length > 0;
    return {
        commitMessage: stagedPaths.length === 0 ? undefined
            : changed ? 'feat: обновить цвета' : 'chore: согласовать отключённые цвета',
        pushRequired: stagedPaths.length > 0 || branchAdvanced,
        stalePullRequestNumber: changed ? undefined : pullRequestNumber,
        pullRequest: changed ? {
            title: 'feat: обновить цвета',
            body: makePullRequestBody(results),
            number: pullRequestNumber,
        } : undefined,
    };
}
