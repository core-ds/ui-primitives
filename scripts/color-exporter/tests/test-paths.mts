import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const sourceRoot = path.resolve(
    workspaceRoot,
    process.env.COLOR_EXPORTER_SOURCE_ROOT ?? '.',
);

/** Путь к файлу, который поставляется внутри папки экспортёра. */
export function sourceFile(...parts: string[]): string {
    return path.join(sourceRoot, ...parts);
}

/** Путь от корня репозитория, в котором запускается проверка. */
export function workspaceFile(...parts: string[]): string {
    return path.join(workspaceRoot, ...parts);
}
