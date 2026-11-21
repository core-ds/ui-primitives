export function ensureArray<T>(value: T | T[]) {
    return Array.isArray(value) ? value : [value];
}
