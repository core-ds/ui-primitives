import { normalizeReportResults } from './report-contract.mjs';
import { countWithRussianForm } from './russian-forms.mjs';
import type { PaletteRunResult } from '../core/types.mjs';

function describeResult(result: PaletteRunResult): string {
    const parts: string[] = [];
    const { summary } = result;
    if (summary.newTokens > 0) {
        parts.push(countWithRussianForm(summary.newTokens, ['новый токен', 'новых токена', 'новых токенов']));
    }
    if (summary.restoredTokens > 0) {
        parts.push(countWithRussianForm(summary.restoredTokens, [
            'токен возвращён из устаревших',
            'токена возвращены из устаревших',
            'токенов возвращено из устаревших',
        ]));
    }
    if (summary.changedActiveTokens > 0) {
        parts.push(countWithRussianForm(summary.changedActiveTokens, [
            'активный токен обновлён',
            'активных токена обновлены',
            'активных токенов обновлено',
        ]));
    }
    if (summary.newlyDeprecatedTokens > 0) {
        parts.push(countWithRussianForm(summary.newlyDeprecatedTokens, [
            'токен помечен устаревшим',
            'токена помечены устаревшими',
            'токенов помечено устаревшими',
        ]));
    }

    if (parts.length > 0) return parts.join('; ');
    if (result.changed) return 'нормализованы формат или порядок JSON';
    return 'изменений не требуется';
}

function makeDeprecatedSections(results: readonly PaletteRunResult[]): string[] {
    const sections: string[] = [];
    for (const result of results) {
        const keys = result.changes.newlyDeprecatedTokenKeys;
        if (keys.length === 0) continue;
        sections.push(
            `### \`${result.targetJson}\` — ${keys.length}`,
            '',
            '```text',
            ...keys,
            '```',
            '',
        );
    }
    if (sections.length === 0) return [];

    return [
        '## Новые устаревшие токены',
        '',
        'Перечислены только ключи, которые получили `deprecated: true` в этом запуске.',
        '',
        ...sections,
    ];
}

/** Создаёт стабильное русское описание реквеста только из результата алгоритма. */
export function makePullRequestBody(results: readonly PaletteRunResult[]): string {
    const normalizedResults = normalizeReportResults(results);
    const tableRows = normalizedResults.map((result) => (
        `| \`${result.targetJson}\` | ${result.summary.activeTokens} | ${result.summary.deprecatedTokens} | ${describeResult(result)} |`
    ));
    const totals = normalizedResults.reduce((accumulator, result) => ({
        sections: accumulator.sections + result.summary.sections,
        frames: accumulator.frames + result.summary.frames,
        rectangles: accumulator.rectangles + result.summary.rectangles,
        active: accumulator.active + result.summary.activeTokens,
        deprecated: accumulator.deprecated + result.summary.deprecatedTokens,
    }), { sections: 0, frames: 0, rectangles: 0, active: 0, deprecated: 0 });

    return [
        '## Что изменилось',
        '',
        'Цветовые токены синхронизированы с экспортными страницами Figma REST.',
        '',
        '| Файл | Активные | Устаревшие | Результат |',
        '|---|---:|---:|---|',
        ...tableRows,
        '',
        `Проверено: ${countWithRussianForm(totals.sections, ['секция', 'секции', 'секций'])}, `
            + `${countWithRussianForm(totals.frames, ['фрейм', 'фрейма', 'фреймов'])} и `
            + `${countWithRussianForm(totals.rectangles, ['прямоугольник', 'прямоугольника', 'прямоугольников'])}. `
            + `Итог: ${countWithRussianForm(totals.active, ['активный токен', 'активных токена', 'активных токенов'])} и `
            + `${countWithRussianForm(totals.deprecated, ['устаревший токен', 'устаревших токена', 'устаревших токенов'])}.`,
        '',
        ...makeDeprecatedSections(normalizedResults),
        '## Гарантии',
        '',
        '- преобразование выполнено детерминированным кодом без ИИ и Figma MCP;',
        '- активные токены сортируются по полному JSON-ключу;',
        '- поля активного токена всегда идут как `rgba`, `hex`, `figma`, `web`, `alias`;',
        '- отсутствующий токен не удаляется, а переносится в отдельный устаревший хвост;',
        '- автоматическое слияние реквеста не выполняется.',
        '',
    ].join('\n');
}
