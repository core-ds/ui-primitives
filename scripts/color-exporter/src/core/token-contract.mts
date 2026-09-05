import { assertExactKeys, invariant, isPlainObject } from './assertions.mjs';
import type { CanonicalColorToken, PaletteIdentity } from './types.mjs';

export const CANONICAL_TOKEN_FIELDS = Object.freeze([
    'rgba',
    'hex',
    'figma',
    'web',
    'alias',
]);

/** Проверяет полный публичный контракт активного цветового токена. */
export function validateCanonicalToken(
    token: unknown,
    identity: Pick<PaletteIdentity, 'key' | 'figma'>,
): asserts token is CanonicalColorToken {
    invariant(isPlainObject(token), `адаптер ${identity.key} должен вернуть объект токена`);
    assertExactKeys(token, CANONICAL_TOKEN_FIELDS, `токен ${identity.key}`);

    for (const field of CANONICAL_TOKEN_FIELDS) {
        invariant(
            typeof token[field] === 'string' && token[field].length > 0,
            `поле ${identity.key}.${field} должно быть непустой строкой`,
        );
    }
    invariant(
        token.figma === identity.figma,
        `адаптер изменил вычисленный путь Figma для ${identity.key}`,
    );
}
