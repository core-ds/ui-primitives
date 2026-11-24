import { Config, IgnoreConfig } from './index.mjs';

export function ensureArray<T>(value: T | T[]) {
    return Array.isArray(value) ? value : [value];
}

export function isIgnoreConfig(config: Config): config is IgnoreConfig {
    return !('files' in config) && !('plugins' in config);
}
