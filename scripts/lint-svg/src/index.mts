export type Severity = 'off' | 'warn' | 'error';

/**
 * Like in ESLint, a bare severity keeps the options set by a previous config object.
 */
export type RuleEntry<Options = never> = [Options] extends [never] ? Severity : Severity | [Severity, Options?];

export type ForbiddenElement = 'clipPath' | 'mask' | 'linearGradient' | 'radialGradient';

export interface Rules {
    /**
     * Requires the file name to match `pattern`.
     */
    filename?: RuleEntry<{ pattern: RegExp }>;
    /**
     * Forbids elements that depend on document-unique ids, unless listed in `allow`.
     */
    'forbidden-element'?: RuleEntry<{ allow?: ForbiddenElement[] }>;
}

type X<T extends keyof Rules = keyof Rules> = [T, NonNullable<Rules[T]> extends RuleEntry<infer V> ? V : never];

export interface Config {
    /**
     * Glob pattern(s) relative to the working directory. If omitted, the object applies to every file.
     */
    files?: string | string[];
    /**
     * Glob pattern(s) relative to the working directory. In an object without other keys the patterns are
     * global, i.e. matching files are not linted at all.
     */
    ignore?: string | string[];
    rules?: Rules;
}

export function defineConfig(config: Config): Config;
export function defineConfig(config: Config[]): Config[];
export function defineConfig(config: Config | Config[]) {
    return config;
}
