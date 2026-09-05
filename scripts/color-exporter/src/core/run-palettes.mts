import { readFile } from 'node:fs/promises';

import { invariant } from './assertions.mjs';
import {
    hasFigmaPalettePage,
    listExportPalettePageNames,
    parseFigmaPalette,
} from './parse-layout.mjs';
import { fetchFigmaFile } from './fetch-figma.mjs';
import {
    assertSafeTargetPath,
    readJsonFileIfExists,
    resolveTargetPath,
    serializeJson,
    writePreparedFiles,
} from './json-files.mjs';
import { compareCodeUnits } from './stable-order.mjs';
import { synchronizePalette } from './sync-palette.mjs';
import type {
    PaletteDefinition,
    PaletteRunResult,
    PreparedPaletteRun,
    RunPalettesOptions,
} from './types.mjs';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function parseBaselineJson(text: string, targetJson: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(
            `Экспорт цветов: исходная версия ${targetJson} содержит неправильный JSON: ${errorMessage(error)}`,
            { cause: error },
        );
    }
}

interface PrepareOnePaletteOptions {
    palette: PaletteDefinition;
    repoRoot: string;
    figmaFile: unknown;
    baselineProvided: boolean;
    baselineText?: string;
}

async function prepareOnePalette({
    palette,
    repoRoot,
    figmaFile,
    baselineProvided,
    baselineText,
}: PrepareOnePaletteOptions): Promise<PreparedPaletteRun> {
    const targetPath = resolveTargetPath(repoRoot, palette.targetJson);
    await assertSafeTargetPath(repoRoot, targetPath);
    const oldFile = await readJsonFileIfExists(targetPath);
    const effectiveBaselineText = baselineProvided ? baselineText : oldFile?.text;
    const baselinePalette = effectiveBaselineText === undefined
        ? {}
        : baselineProvided
            ? parseBaselineJson(effectiveBaselineText, palette.targetJson)
            : oldFile?.json;
    invariant(baselinePalette !== undefined, `не удалось определить исходную версию ${palette.targetJson}`);
    const parsed = parseFigmaPalette(figmaFile, palette);
    const synchronized = synchronizePalette(baselinePalette, parsed.tokens);
    const nextText = serializeJson(synchronized.palette);

    return {
        paletteId: palette.id,
        targetJson: palette.targetJson,
        targetPath,
        oldText: oldFile?.text,
        nextText,
        mode: oldFile?.mode ?? 0o644,
        changed: effectiveBaselineText === undefined || effectiveBaselineText !== nextText,
        writeNeeded: oldFile === undefined || oldFile.text !== nextText,
        changes: synchronized.changes,
        summary: {
            ...parsed.counts,
            ...synchronized.summary,
        },
    };
}

async function readFigmaSnapshot(figmaJsonPath: string | URL): Promise<unknown> {
    let text: string;
    try {
        text = await readFile(figmaJsonPath, 'utf8');
    } catch (error) {
        throw new Error(`Экспорт цветов: не удалось прочитать снимок Figma ${figmaJsonPath}: ${errorMessage(error)}`, { cause: error });
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Экспорт цветов: снимок Figma ${figmaJsonPath} содержит неправильный JSON: ${errorMessage(error)}`, { cause: error });
    }
}

function validateRunSelection(palettes: readonly PaletteDefinition[], repoRoot: string): void {
    invariant(Array.isArray(palettes), 'палитры должны быть массивом');
    invariant(typeof repoRoot === 'string' && repoRoot.length > 0, 'repoRoot должен быть непустой строкой');

    const ids = new Set<string>();
    const targets = new Set<string>();
    for (const palette of palettes) {
        invariant(!ids.has(palette.id), `палитра ${palette.id} выбрана несколько раз`);
        invariant(!targets.has(palette.targetJson), `файл ${palette.targetJson} выбран несколько раз`);
        ids.add(palette.id);
        targets.add(palette.targetJson);
    }
}

function validateBaselineSources({
    baselineJsonTexts,
    loadBaselineJsonText,
}: Pick<RunPalettesOptions, 'baselineJsonTexts' | 'loadBaselineJsonText'>): void {
    invariant(
        baselineJsonTexts === undefined || baselineJsonTexts instanceof Map,
        'исходные JSON основной ветки должны быть Map',
    );
    invariant(
        loadBaselineJsonText === undefined || typeof loadBaselineJsonText === 'function',
        'загрузчик исходных JSON основной ветки должен быть функцией',
    );
    invariant(
        baselineJsonTexts === undefined || loadBaselineJsonText === undefined,
        'нельзя одновременно передать Map и загрузчик исходных JSON',
    );
}

/**
 * Двухфазный запуск: сначала все наборы читаются, проверяются и вычисляются.
 * Только если каждый набор успешен, результаты разрешается записать.
 */
export async function runPalettes({
    palettes,
    selectedPaletteId,
    repoRoot,
    figmaToken,
    check = false,
    figmaJsonPath,
    fetchImplementation,
    createPaletteForPage,
    baselineJsonTexts,
    loadBaselineJsonText,
}: RunPalettesOptions): Promise<PaletteRunResult[]> {
    validateRunSelection(palettes, repoRoot);
    validateBaselineSources({ baselineJsonTexts, loadBaselineJsonText });
    invariant(typeof check === 'boolean', 'check должен быть логическим значением');
    invariant(
        selectedPaletteId === undefined
            || (typeof selectedPaletteId === 'string' && /^[a-z0-9-]+$/.test(selectedPaletteId)),
        'идентификатор выбранной палитры должен содержать строчные латинские буквы, цифры и дефисы',
    );
    invariant(
        createPaletteForPage === undefined || typeof createPaletteForPage === 'function',
        'фабрика стандартной палитры должна быть функцией',
    );
    const usesSnapshot = figmaJsonPath !== undefined;
    if (usesSnapshot) {
        invariant(
            (typeof figmaJsonPath === 'string' && figmaJsonPath.length > 0)
                || figmaJsonPath instanceof URL,
            'figmaJsonPath должен быть непустым путём или file URL',
        );
    }
    const fixedFigmaFile = usesSnapshot
        ? await readFigmaSnapshot(figmaJsonPath)
        : undefined;

    const figmaFile = usesSnapshot
        ? fixedFigmaFile
        : await fetchFigmaFile({
            token: figmaToken,
            fetchImplementation,
        });

    const exportPageNames = listExportPalettePageNames(figmaFile);
    const resolvedPalettes: PaletteDefinition[] = [...palettes];
    if (createPaletteForPage !== undefined) {
        const explicitlyConfiguredPages = new Set(
            palettes.map((palette) => palette.figma.pageName),
        );
        for (const pageName of exportPageNames) {
            if (!explicitlyConfiguredPages.has(pageName)) {
                resolvedPalettes.push(createPaletteForPage({ pageName }));
            }
        }
    }
    resolvedPalettes.sort((left, right) => compareCodeUnits(left.targetJson, right.targetJson));
    validateRunSelection(resolvedPalettes, repoRoot);

    const selectedPalettes = selectedPaletteId === undefined
        ? resolvedPalettes
        : resolvedPalettes.filter((palette) => palette.id === selectedPaletteId);
    invariant(selectedPaletteId === undefined || selectedPalettes.length > 0, `палитра ${selectedPaletteId} не найдена`);
    const activePalettes = selectedPalettes.filter((palette) => (
        hasFigmaPalettePage(figmaFile, palette.figma.pageName)
    ));

    async function readBaseline(palette: PaletteDefinition): Promise<{
        baselineProvided: boolean;
        baselineText?: string;
    }> {
        if (baselineJsonTexts !== undefined) {
            invariant(
                baselineJsonTexts.has(palette.targetJson),
                `нет исходной версии ${palette.targetJson} из основной ветки`,
            );
            const baselineText = baselineJsonTexts.get(palette.targetJson);
            invariant(
                baselineText === undefined || typeof baselineText === 'string',
                `исходная версия ${palette.targetJson} должна быть строкой или отсутствовать`,
            );
            return { baselineProvided: true, baselineText };
        }
        if (loadBaselineJsonText !== undefined) {
            const baselineText = await loadBaselineJsonText(palette.targetJson);
            invariant(
                baselineText === undefined || typeof baselineText === 'string',
                `загрузчик вернул неправильную исходную версию ${palette.targetJson}`,
            );
            return { baselineProvided: true, baselineText };
        }
        return { baselineProvided: false };
    }

    const preparedRuns = await Promise.all(
        activePalettes.map(async (palette) => {
            return prepareOnePalette({
                palette,
                repoRoot,
                figmaFile,
                ...await readBaseline(palette),
            });
        }),
    );

    if (!check && preparedRuns.length > 0) {
        await writePreparedFiles(preparedRuns);
    }

    return preparedRuns.map(({
        oldText,
        nextText,
        targetPath,
        mode,
        writeNeeded,
        ...publicResult
    }) => publicResult);
}
