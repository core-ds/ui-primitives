import { invariant, isPlainObject } from '../core/assertions.mjs';
import { compareCodeUnits, sortTokenKeys } from '../core/stable-order.mjs';
import type {
    JsonObject,
    PaletteRunResult,
    PaletteRunSummary,
    SynchronizationChanges,
} from '../core/types.mjs';

const CHANGE_FIELDS = Object.freeze([
    ['newTokenKeys', 'newTokens'],
    ['restoredTokenKeys', 'restoredTokens'],
    ['changedActiveTokenKeys', 'changedActiveTokens'],
    ['newlyDeprecatedTokenKeys', 'newlyDeprecatedTokens'],
] as const);

function requireNonNegativeInteger(value: unknown, description: string): number {
    invariant(
        typeof value === 'number' && Number.isInteger(value) && value >= 0,
        `${description} должно быть целым неотрицательным числом`,
    );
    return value;
}

function requireChangedKeys(value: unknown, description: string): string[] {
    invariant(Array.isArray(value), `${description} должен быть массивом`);
    invariant(value.every((key) => typeof key === 'string'), `${description} должен содержать строки`);
    invariant(new Set(value).size === value.length, `${description} содержит повторы`);
    return sortTokenKeys(value);
}

function readSummary(summary: JsonObject, targetJson: string): PaletteRunSummary {
    return {
        sections: requireNonNegativeInteger(summary.sections, `${targetJson}: summary.sections`),
        frames: requireNonNegativeInteger(summary.frames, `${targetJson}: summary.frames`),
        rectangles: requireNonNegativeInteger(summary.rectangles, `${targetJson}: summary.rectangles`),
        placeholders: requireNonNegativeInteger(summary.placeholders, `${targetJson}: summary.placeholders`),
        tokens: requireNonNegativeInteger(summary.tokens, `${targetJson}: summary.tokens`),
        oldTokens: requireNonNegativeInteger(summary.oldTokens, `${targetJson}: summary.oldTokens`),
        resultTokens: requireNonNegativeInteger(summary.resultTokens, `${targetJson}: summary.resultTokens`),
        activeTokens: requireNonNegativeInteger(summary.activeTokens, `${targetJson}: summary.activeTokens`),
        deprecatedTokens: requireNonNegativeInteger(summary.deprecatedTokens, `${targetJson}: summary.deprecatedTokens`),
        newTokens: requireNonNegativeInteger(summary.newTokens, `${targetJson}: summary.newTokens`),
        restoredTokens: requireNonNegativeInteger(summary.restoredTokens, `${targetJson}: summary.restoredTokens`),
        changedActiveTokens: requireNonNegativeInteger(summary.changedActiveTokens, `${targetJson}: summary.changedActiveTokens`),
        newlyDeprecatedTokens: requireNonNegativeInteger(summary.newlyDeprecatedTokens, `${targetJson}: summary.newlyDeprecatedTokens`),
    };
}

function normalizeResult(result: unknown): PaletteRunResult {
    invariant(isPlainObject(result), 'результат палитры должен быть объектом');
    invariant(typeof result.paletteId === 'string' && result.paletteId.length > 0, 'у результата палитры нет paletteId');
    invariant(
        typeof result.targetJson === 'string' && /^styles\/colors_[a-z0-9_]+\.json$/.test(result.targetJson),
        `недопустимый путь в отчёте: ${String(result.targetJson)}`,
    );
    invariant(typeof result.changed === 'boolean', `${result.targetJson}: поле changed должно быть логическим`);
    invariant(isPlainObject(result.summary), `${result.targetJson}: summary обязателен`);
    invariant(isPlainObject(result.changes), `${result.targetJson}: changes обязателен`);

    const summary = readSummary(result.summary, result.targetJson);
    invariant(
        summary.rectangles === summary.tokens + summary.placeholders,
        `${result.targetJson}: число прямоугольников не совпадает с токенами и заглушками`,
    );
    invariant(
        summary.tokens === summary.activeTokens,
        `${result.targetJson}: число разобранных токенов не совпадает с активной группой`,
    );
    invariant(
        summary.resultTokens === summary.activeTokens + summary.deprecatedTokens,
        `${result.targetJson}: общее число токенов не совпадает с активной и устаревшей группами`,
    );

    const normalizedChanges = {} as SynchronizationChanges;
    const allChangedKeys = new Set<string>();
    for (const [changeField, summaryField] of CHANGE_FIELDS) {
        const keys = requireChangedKeys(
            result.changes[changeField],
            `${result.targetJson}: changes.${changeField}`,
        );
        for (const key of keys) {
            invariant(!allChangedKeys.has(key), `${result.targetJson}: ключ ${key} попал в несколько видов изменений`);
            allChangedKeys.add(key);
        }
        normalizedChanges[changeField] = keys;
        invariant(
            summary[summaryField] === keys.length,
            `${result.targetJson}: summary.${summaryField} не совпадает с changes.${changeField}`,
        );
    }

    invariant(
        summary.resultTokens === summary.oldTokens + summary.newTokens,
        `${result.targetJson}: итоговое число токенов не совпадает с исходными и новыми`,
    );
    invariant(
        summary.newTokens + summary.restoredTokens + summary.changedActiveTokens <= summary.activeTokens,
        `${result.targetJson}: изменённых активных токенов больше, чем всего активных`,
    );
    invariant(
        summary.newlyDeprecatedTokens <= summary.deprecatedTokens,
        `${result.targetJson}: новых устаревших токенов больше, чем всего устаревших`,
    );
    const hasNamedChanges = Object.values(normalizedChanges).some((keys) => keys.length > 0);
    invariant(result.changed || !hasNamedChanges, `${result.targetJson}: список изменений не может быть непустым при changed: false`);

    return {
        paletteId: result.paletteId,
        targetJson: result.targetJson,
        changed: result.changed,
        changes: normalizedChanges,
        summary,
    };
}

/** Проверяет и стабильно упорядочивает данные для отчёта. */
export function normalizeReportResults(results: unknown): PaletteRunResult[] {
    invariant(Array.isArray(results) && results.length > 0, 'для отчёта нужны результаты палитр');
    const normalizedResults = results
        .map(normalizeResult)
        .sort((left, right) => compareCodeUnits(left.targetJson, right.targetJson));
    invariant(
        new Set(normalizedResults.map((result) => result.targetJson)).size === normalizedResults.length,
        'в отчёте повторяются целевые JSON',
    );
    return normalizedResults;
}
