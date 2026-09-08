/** Проверяем внешние данные; внутренние результаты защищает TypeScript. */
export function requireValue(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function object(value: unknown): Record<string, unknown> {
    requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Ожидался объект');
    return value as Record<string, unknown>;
}

export const PAGE = /^colors_([a-z0-9_]+)\.json$/;
export const TARGET = /^styles\/colors_[a-z0-9_]+\.json$/;
export const FILE_KEY = 'JGR9GpDXUneyYHfDdb7BDT';
export type Token = { rgba: string; hex: string; figma: string; web: string; alias: string };
export type Rule = {
    section: RegExp;
    frame?: RegExp;
    literal?: boolean;
    defaultOnly?: boolean | ((section: string, frame: string) => boolean);
};

/** `_` раньше цифр и букв: порядок не зависит от языка операционной системы. */
export function sorted<T>(entries: Iterable<[string, T]>): [string, T][] {
    const items = [...entries];
    for (const [key] of items) {
        const number = Number(key);
        requireValue(/^[a-z0-9_]+$/.test(key) && !(number >= 0 && number < 0xffffffff && String(number) === key && Number.isInteger(number)), `Недопустимый ключ ${key}`);
    }
    const rank = (key: string) => key.replaceAll('_', '!');
    return items.sort(([a], [b]) => rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0);
}
