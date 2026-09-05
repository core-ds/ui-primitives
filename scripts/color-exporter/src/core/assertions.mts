/**
 * Останавливает выполнение с понятной ошибкой, если условие не выполнено.
 *
 * Экспорт цветов намеренно работает строго: лучше сразу показать проблему
 * в раскладке, чем молча записать в код неправильный токен.
 */
import type { JsonObject } from './types.mjs';

export function invariant(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Экспорт цветов: ${message}`);
    }
}

/** Проверяет, что значение является обычным JSON-объектом. */
export function isPlainObject(value: unknown): value is JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/**
 * Проверяет точный набор и порядок полей объекта.
 * Это защищает JSON от случайного изменения его публичного формата.
 */
export function assertExactKeys(
    object: JsonObject,
    expectedKeys: readonly string[],
    description: string,
): void {
    const actualKeys = Object.keys(object);
    invariant(
        actualKeys.length === expectedKeys.length
            && actualKeys.every((key, index) => key === expectedKeys[index]),
        `${description}: ожидались поля ${expectedKeys.join(', ')}, получены ${actualKeys.join(', ')}`,
    );
}
