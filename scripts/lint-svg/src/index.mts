export interface Config {
    ignore?: string[];
}

export function defineConfig(config: Config): Config {
    return config;
}
