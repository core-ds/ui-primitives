import process from 'node:process';

import { invariant } from '../core/assertions.mjs';
import { discoverPalettes } from '../core/discover-palettes.mjs';
import { runPalettes } from '../core/run-palettes.mjs';
import { compareCodeUnits } from '../core/stable-order.mjs';
import { createStandardPaletteForPage } from '../palettes/_create-standard.mjs';
import {
    TARGET_BRANCH,
    checkoutTargetBranch,
    inspectBranchTree,
    makePushArguments,
    readIndexTree,
    readPaletteBaseline,
    restoreInactivePaletteFiles,
    stagePaletteFiles,
    verifyCommittedTree,
} from './git-operations.mjs';
import { preparePublicationPlan } from './publication-plan.mjs';
import { normalizeReportResults } from './report-contract.mjs';
import type { PaletteDefinition, PaletteRunResult } from '../core/types.mjs';
import type {
    GithubContext,
    InactiveConfiguredPage,
    RunGithubActionDependencies,
} from './types.mjs';

const EXPECTED_REPOSITORY = Object.freeze({ owner: 'core-ds', repo: 'ui-primitives' });

export { makePushArguments } from './git-operations.mjs';
export { makePullRequestBody } from './pull-request-body.mjs';

function validateContext(context: GithubContext): string {
    invariant(context && typeof context === 'object', 'контекст GitHub Actions не передан');
    invariant(
        context.repo?.owner === EXPECTED_REPOSITORY.owner && context.repo?.repo === EXPECTED_REPOSITORY.repo,
        `экспорт разрешён только в ${EXPECTED_REPOSITORY.owner}/${EXPECTED_REPOSITORY.repo}`,
    );
    invariant(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(context.sha ?? ''), 'context.sha должен быть полным Git SHA');
    const defaultBranch = context.payload?.repository?.default_branch;
    invariant(typeof defaultBranch === 'string' && defaultBranch.length > 0, 'не удалось определить основную ветку репозитория');
    invariant(
        context.ref === `refs/heads/${defaultBranch}`,
        `экспорт разрешён только из основной ветки ${defaultBranch}`,
    );
    return defaultBranch;
}

function validateSynchronizationResults(
    palettes: readonly PaletteDefinition[],
    results: readonly PaletteRunResult[],
): PaletteRunResult[] {
    invariant(Array.isArray(results), 'синхронизатор должен вернуть массив результатов');
    const explicitPairs = new Set(palettes.map((palette) => `${palette.id}\0${palette.targetJson}`));
    const ids = new Set<string>();
    const targets = new Set<string>();
    let previousTarget: string | undefined;

    for (const result of results) {
        invariant(result && typeof result === 'object', 'результат палитры должен быть объектом');
        invariant(typeof result.paletteId === 'string' && result.paletteId.length > 0, 'у результата нет id палитры');
        invariant(
            typeof result.targetJson === 'string'
                && /^styles\/colors_[a-z0-9_]+\.json$/.test(result.targetJson),
            `синхронизатор вернул недопустимый путь ${String(result.targetJson)}`,
        );
        invariant(!ids.has(result.paletteId), `синхронизатор повторил палитру ${result.paletteId}`);
        invariant(!targets.has(result.targetJson), `синхронизатор повторил файл ${result.targetJson}`);
        invariant(
            previousTarget === undefined || compareCodeUnits(previousTarget, result.targetJson) < 0,
            'синхронизатор вернул палитры в нестабильном порядке',
        );

        const pageName = result.targetJson.slice('styles/'.length);
        const standardId = pageName
            .slice('colors_'.length, -'.json'.length)
            .replaceAll('_', '-');
        invariant(
            explicitPairs.has(`${result.paletteId}\0${result.targetJson}`)
                || result.paletteId === standardId,
            `синхронизатор вернул несогласованный результат ${result.paletteId} -> ${result.targetJson}`,
        );
        ids.add(result.paletteId);
        targets.add(result.targetJson);
        previousTarget = result.targetJson;
    }
    return results.length === 0 ? [] : normalizeReportResults(results);
}

/** Возвращает стабильный список явных модулей, страницы которых отсутствуют. */
function listInactiveConfiguredPages(
    palettes: readonly PaletteDefinition[],
    results: readonly PaletteRunResult[],
): InactiveConfiguredPage[] {
    const activePairs = new Set(
        results.map((result) => `${result.paletteId}\0${result.targetJson}`),
    );
    return palettes
        .filter((palette) => !activePairs.has(`${palette.id}\0${palette.targetJson}`))
        .map((palette) => ({
            paletteId: palette.id,
            pageName: palette.figma.pageName,
            targetJson: palette.targetJson,
        }))
        .sort((left, right) => compareCodeUnits(left.targetJson, right.targetJson));
}

function describeInactiveConfiguredPages(pages: readonly InactiveConfiguredPage[]): string {
    if (pages.length === 0) return 'Настроенные особые страницы без источника Figma: нет.';
    const descriptions = pages.map((page) => (
        `${page.paletteId}: ${page.pageName} → ${page.targetJson}`
    ));
    return `Настроенные особые страницы без источника Figma: ${descriptions.join(', ')}.`;
}

/**
 * Общая обвязка GitHub Actions. Явные модули задают особые правила страниц,
 * а все страницы читаются из единственного Color Exporter.
 */
export default async function runGithubAction({
    github,
    context,
    exec,
    environment = process.env,
    discover = discoverPalettes,
    synchronize = runPalettes,
    report = () => undefined,
}: RunGithubActionDependencies) {
    const repoRoot = environment.GITHUB_WORKSPACE;
    invariant(repoRoot, 'GITHUB_WORKSPACE не задан');
    invariant(typeof environment.FIGMA_TOKEN === 'string' && environment.FIGMA_TOKEN.length > 0, 'FIGMA_TOKEN не задан');
    invariant(typeof exec?.exec === 'function' && typeof exec?.getExecOutput === 'function', 'объект GitHub Actions exec неполон');
    invariant(
        typeof github?.rest?.pulls?.list === 'function'
            && typeof github.rest.pulls.create === 'function'
            && typeof github.rest.pulls.update === 'function',
        'клиент GitHub Pull Requests неполон',
    );
    const baseBranch = validateContext(context);

    const palettes = await discover();

    await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
    await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
    const checkout = await checkoutTargetBranch({ exec, context });

    const synchronizationResults = await synchronize({
        palettes,
        repoRoot,
        figmaToken: environment.FIGMA_TOKEN,
        createPaletteForPage: createStandardPaletteForPage,
        loadBaselineJsonText: (targetPath) => readPaletteBaseline({
            exec,
            baseSha: context.sha,
            targetPath,
        }),
    });
    const results = validateSynchronizationResults(palettes, synchronizationResults);
    const inactiveConfiguredPages = listInactiveConfiguredPages(palettes, results);
    report(describeInactiveConfiguredPages(inactiveConfiguredPages));

    const activeTargetPaths = results.map((result) => result.targetJson);
    // Постоянная ветка может хранить результат прошлого запуска для страницы,
    // которой теперь нет. Восстанавливаются только такие неактивные пути;
    // рассчитанные выше файлы активных страниц сюда не попадают.
    const revertedPaths = await restoreInactivePaletteFiles({
        exec,
        baseSha: context.sha,
        activeTargetPaths,
    });
    const stagedPaths = await stagePaletteFiles({
        exec,
        targetPaths: activeTargetPaths,
        restoredPaths: revertedPaths,
    });
    const branchPaths = await inspectBranchTree({
        exec,
        baseSha: context.sha,
        targetPaths: activeTargetPaths,
    });
    const expectedTreeSha = await readIndexTree(exec);

    const { owner, repo } = context.repo;
    const openPullRequests = await github.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        base: baseBranch,
        head: `${owner}:${TARGET_BRANCH}`,
        per_page: 2,
    });
    const publication = preparePublicationPlan({
        results,
        branchPaths,
        stagedPaths,
        branchAdvanced: checkout.branchAdvanced,
        openPullRequests: openPullRequests.data,
    });

    let pushed = false;
    if (publication.commitMessage !== undefined) {
        await exec.exec('git', ['commit', '-m', publication.commitMessage]);
    }
    if (publication.pushRequired) {
        await verifyCommittedTree(exec, expectedTreeSha);
        await exec.exec('git', makePushArguments());
        pushed = true;
    }

    if (publication.pullRequest === undefined) {
        if (publication.stalePullRequestNumber !== undefined) {
            report(`Реквест #${publication.stalePullRequestNumber} устарел: разницы с основной веткой нет. Проверьте и закройте его вручную.`);
        }
        return {
            changed: false,
            pushed,
            stagedPaths,
            branchPaths,
            revertedPaths,
            remoteBranchExisted: checkout.remoteBranchExisted,
            stalePullRequest: publication.stalePullRequestNumber !== undefined,
            inactiveConfiguredPages,
            results,
        };
    }

    const pullRequestData = {
        owner,
        repo,
        base: baseBranch,
        head: TARGET_BRANCH,
        title: publication.pullRequest.title,
        body: publication.pullRequest.body,
    };

    if (publication.pullRequest.number === undefined) {
        await github.rest.pulls.create(pullRequestData);
    } else {
        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: publication.pullRequest.number,
            title: pullRequestData.title,
            body: pullRequestData.body,
        });
    }

    return {
        changed: true,
        pushed,
        stagedPaths,
        branchPaths,
        revertedPaths,
        remoteBranchExisted: checkout.remoteBranchExisted,
        inactiveConfiguredPages,
        results,
    };
}
