import { invariant, isPlainObject } from './assertions.mjs';
import { sortTokenEntries, sortTokenKeys } from './stable-order.mjs';
import type {
    JsonObject,
    SynchronizedPalette,
    SynchronizationChanges,
} from './types.mjs';

/**
 * Делает активный исторический токен устаревшим и ставит deprecated последним.
 * Уже устаревший объект возвращается без перестановки полей: источника Figma
 * у него больше нет, поэтому лишняя нормализация создала бы шум в реквесте.
 */
function makeDeprecatedToken(oldToken: JsonObject): JsonObject {
    if (oldToken.deprecated === true) {
        return { ...oldToken };
    }

    const preservedEntries = Object.entries(oldToken).filter(([field]) => field !== 'deprecated');
    return {
        ...Object.fromEntries(preservedEntries),
        deprecated: true,
    };
}

/**
 * Объединяет свежие токены Figma с предыдущим JSON.
 *
 * Сначала идут все активные токены по алфавиту, затем отдельный алфавитный
 * хвост устаревших. Это повторяет правило действующего экспорта типографики.
 */
export function synchronizePalette(
    oldPalette: unknown,
    parsedTokens: ReadonlyMap<string, JsonObject>,
): SynchronizedPalette {
    invariant(isPlainObject(oldPalette), 'целевой JSON должен быть объектом');
    invariant(parsedTokens instanceof Map, 'разобранные токены должны быть Map');

    const oldKeys = Object.keys(oldPalette);
    const changes: SynchronizationChanges = {
        newTokenKeys: [],
        restoredTokenKeys: [],
        changedActiveTokenKeys: [],
        newlyDeprecatedTokenKeys: [],
    };

    const activeEntries: Array<readonly [string, JsonObject]> = sortTokenEntries(parsedTokens.entries()).map(([key, generatedToken]) => {
        // `constructor` и `__proto__` допустимы регулярным выражением ключа,
        // поэтому наследуемые свойства Object нельзя считать старыми токенами.
        const oldToken = Object.hasOwn(oldPalette, key) ? oldPalette[key] : undefined;
        if (oldToken === undefined) {
            changes.newTokenKeys.push(key);
        } else {
            invariant(isPlainObject(oldToken), `старый токен ${key} должен быть объектом`);
            if (oldToken.deprecated === true) {
                changes.restoredTokenKeys.push(key);
            } else if (JSON.stringify(oldToken) !== JSON.stringify(generatedToken)) {
                changes.changedActiveTokenKeys.push(key);
            }
        }
        return [key, generatedToken] as const;
    });

    const deprecatedEntries: Array<readonly [string, JsonObject]> = [];
    for (const [key, oldToken] of Object.entries(oldPalette)) {
        invariant(isPlainObject(oldToken), `старый токен ${key} должен быть объектом`);
        if (parsedTokens.has(key)) {
            continue;
        }
        if (oldToken.deprecated !== true) {
            changes.newlyDeprecatedTokenKeys.push(key);
        }
        deprecatedEntries.push([key, makeDeprecatedToken(oldToken)] as const);
    }

    const sortedDeprecatedEntries = sortTokenEntries(deprecatedEntries);
    changes.newTokenKeys = sortTokenKeys(changes.newTokenKeys);
    changes.restoredTokenKeys = sortTokenKeys(changes.restoredTokenKeys);
    changes.changedActiveTokenKeys = sortTokenKeys(changes.changedActiveTokenKeys);
    changes.newlyDeprecatedTokenKeys = sortTokenKeys(changes.newlyDeprecatedTokenKeys);
    const palette = Object.fromEntries(activeEntries.concat(sortedDeprecatedEntries));

    return {
        palette,
        changes,
        summary: {
            oldTokens: oldKeys.length,
            resultTokens: activeEntries.length + sortedDeprecatedEntries.length,
            activeTokens: activeEntries.length,
            deprecatedTokens: sortedDeprecatedEntries.length,
            newTokens: changes.newTokenKeys.length,
            restoredTokens: changes.restoredTokenKeys.length,
            changedActiveTokens: changes.changedActiveTokenKeys.length,
            newlyDeprecatedTokens: changes.newlyDeprecatedTokenKeys.length,
        },
    };
}
