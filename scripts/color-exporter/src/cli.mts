import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { invariant } from './core/assertions.mjs';
import { discoverPalettes } from './core/discover-palettes.mjs';
import { runPalettes } from './core/run-palettes.mjs';
import { createStandardPaletteForPage } from './palettes/_create-standard.mjs';
import type { PaletteDefinition, PaletteRunResult, RunPalettesOptions } from './core/types.mjs';

const HELP = `
Локальный запуск экспорта цветов

Обязательные параметры:
  --repo-root <путь>         Корень репозитория с папкой styles

Необязательные параметры:
  --palette <id|all>         Один набор или все наборы; по умолчанию all
  --figma-json <путь>        Сохранённый полный ответ Figma REST
  --check                    Ничего не записывать; код 2 означает, что есть изменения
  --help                     Показать эту справку
`;

export interface CliOptions {
    repoRoot?: string;
    palette: string;
    figmaJsonPath?: string;
    check: boolean;
    help: boolean;
}

export function parseCliArguments(argumentsList: readonly string[]): CliOptions {
    const options: CliOptions = {
        palette: 'all',
        check: false,
        help: false,
    };
    const seenOptions = new Set<string>();

    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        invariant(argument !== undefined, 'внутренняя ошибка разбора параметров');
        if (argument === '--check' || argument === '--help') {
            invariant(!seenOptions.has(argument), `параметр ${argument} указан несколько раз`);
            seenOptions.add(argument);
            if (argument === '--check') options.check = true;
            else options.help = true;
            continue;
        }

        invariant(
            argument === '--repo-root' || argument === '--palette' || argument === '--figma-json',
            `неизвестный параметр ${argument}`,
        );
        invariant(!seenOptions.has(argument), `параметр ${argument} указан несколько раз`);
        const value = argumentsList[index + 1];
        invariant(value && !value.startsWith('--'), `после ${argument} требуется значение`);
        seenOptions.add(argument);
        index += 1;
        if (argument === '--repo-root') options.repoRoot = value;
        else if (argument === '--palette') options.palette = value;
        else options.figmaJsonPath = value;
    }

    return options;
}

interface OutputLike {
    write(value: string): unknown;
}

export interface CliDependencies {
    environment?: Record<string, string | undefined>;
    output?: OutputLike;
    discover?: () => Promise<PaletteDefinition[]>;
    run?: (options: RunPalettesOptions) => Promise<PaletteRunResult[]>;
}

export interface CliResult {
    results: PaletteRunResult[];
    exitCode: number;
}

export async function main(
    argumentsList: string[] = process.argv.slice(2),
    {
        environment = process.env,
        output = process.stdout,
        discover = discoverPalettes,
        run = runPalettes,
    }: CliDependencies = {},
): Promise<CliResult> {
    const options = parseCliArguments(argumentsList);
    if (options.help) {
        output.write(HELP);
        return { results: [], exitCode: 0 };
    }

    invariant(options.repoRoot, '--repo-root обязателен');
    const discoveredPalettes = await discover();
    const results = await run({
        palettes: discoveredPalettes,
        selectedPaletteId: options.palette === 'all' ? undefined : options.palette,
        repoRoot: options.repoRoot,
        figmaToken: environment.FIGMA_TOKEN,
        check: options.check,
        figmaJsonPath: options.figmaJsonPath,
        createPaletteForPage: createStandardPaletteForPage,
    });
    output.write(`${JSON.stringify(results, null, 2)}\n`);

    const exitCode = options.check && results.some((result) => result.changed) ? 2 : 0;
    return { results, exitCode };
}

const launchedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (launchedFile === import.meta.url) {
    main()
        .then(({ exitCode }) => {
            process.exitCode = exitCode;
        })
        .catch((error: unknown) => {
            const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
            process.stderr.write(`${message}\n`);
            process.exitCode = 1;
        });
}
