import { invariant } from './assertions.mjs';

/**
 * JSON-ключи цветовых токенов состоят только из этих символов.
 * Явный алфавит делает порядок одинаковым на любой операционной системе
 * и не зависит от локали, установленной на машине запуска.
 */
const TOKEN_KEY_ALPHABET = '_0123456789abcdefghijklmnopqrstuvwxyz';
const TOKEN_KEY_RANKS = new Map(
    Array.from(TOKEN_KEY_ALPHABET, (character, index) => [character, index]),
);

export const TOKEN_KEY_PATTERN = /^[a-z0-9_]+$/;

export function assertTokenKey(key: unknown, description = 'ключ токена'): asserts key is string {
    invariant(
        typeof key === 'string' && TOKEN_KEY_PATTERN.test(key),
        `${description} ${String(key)} должен содержать только a-z, 0-9 и _`,
    );
    // Такие свойства обычный объект JavaScript всегда ставит перед остальными,
    // поэтому их нельзя сохранить в алфавитном порядке или в хвосте устаревших.
    const numericKey = Number(key);
    invariant(
        !(Number.isInteger(numericKey)
            && numericKey >= 0
            && numericKey < 0xffffffff
            && String(numericKey) === key),
        `${description} ${key} не должен быть целочисленным индексом JavaScript`,
    );
}

function compareValidTokenKeys(left: string, right: string): number {
    const commonLength = Math.min(left.length, right.length);
    for (let index = 0; index < commonLength; index += 1) {
        const leftRank = TOKEN_KEY_RANKS.get(left[index] ?? '');
        const rightRank = TOKEN_KEY_RANKS.get(right[index] ?? '');
        invariant(leftRank !== undefined && rightRank !== undefined, 'внутренняя ошибка алфавита токенов');
        const difference = leftRank - rightRank;
        if (difference !== 0) {
            return difference;
        }
    }
    return left.length - right.length;
}

/** Сравнивает два ключа по фиксированному алфавиту. */
export function compareTokenKeys(left: string, right: string): number {
    assertTokenKey(left, 'левый ключ');
    assertTokenKey(right, 'правый ключ');
    return compareValidTokenKeys(left, right);
}

/** Возвращает новую, стабильно отсортированную копию списка ключей. */
export function sortTokenKeys(keys: Iterable<string>): string[] {
    const copy = Array.from(keys);
    for (const key of copy) {
        assertTokenKey(key);
    }
    return copy.sort(compareValidTokenKeys);
}

/** Возвращает новую копию пар `[ключ, значение]` в стабильном порядке. */
export function sortTokenEntries<T>(entries: Iterable<readonly [string, T]>): Array<readonly [string, T]> {
    const copy = Array.from(entries);
    for (const [key] of copy) {
        assertTokenKey(key);
    }
    return copy.sort(([left], [right]) => compareValidTokenKeys(left, right));
}

/**
 * Технические имена файлов сортируются по кодовым единицам UTF-16.
 * В отличие от `localeCompare`, результат не зависит от локали процесса.
 */
export function compareCodeUnits(left: string, right: string): number {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}
