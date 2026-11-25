export interface Config {
    files: string | string[];
    ignore?: string | string[];
    pattern: RegExp;
}

export function defineConfig(config: Config[]) {
    return config;
}
