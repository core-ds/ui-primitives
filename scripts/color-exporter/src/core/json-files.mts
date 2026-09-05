import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';

import { invariant } from './assertions.mjs';
import type { ReadJsonFileResult } from './types.mjs';

export { writePreparedFiles } from './file-transaction.mjs';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function resolveTargetPath(repoRoot: string, targetJson: string): string {
    const root = path.resolve(repoRoot);
    const target = path.resolve(root, targetJson);
    const relative = path.relative(root, target);
    invariant(relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `путь ${targetJson} выходит за пределы repo-root`);
    return target;
}

function isMissingFile(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Проверяет реальные узлы пути внутри репозитория, а не только строку пути. */
export async function assertSafeTargetPath(repoRoot: string, targetPath: string): Promise<void> {
    const target = resolveTargetPath(repoRoot, targetPath);
    const relativeParts = path.relative(path.resolve(repoRoot), target).split(path.sep);
    let current = path.resolve(repoRoot);
    for (const [index, part] of relativeParts.entries()) {
        current = path.join(current, part);
        const isTarget = index === relativeParts.length - 1;
        let stats;
        try {
            stats = await lstat(current);
        } catch (error) {
            if (isTarget && isMissingFile(error)) return;
            throw error;
        }
        invariant(
            isTarget ? stats.isFile() : stats.isDirectory(),
            `путь ${current} должен быть ${isTarget ? 'обычным файлом' : 'папкой'}, не символической ссылкой`,
        );
    }
}

async function readJsonFileInternal(
    filePath: string,
    allowMissing: boolean,
): Promise<ReadJsonFileResult | undefined> {
    let text: string;
    let mode: number;
    try {
        // Последний элемент пути нельзя подменить ссылкой между проверкой и open.
        // NONBLOCK не даёт зависнуть, если вместо файла появился именованный канал.
        const fileHandle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
            const stats = await fileHandle.stat();
            invariant(stats.isFile(), `цель ${filePath} должна быть обычным файлом`);
            text = await fileHandle.readFile('utf8');
            mode = stats.mode & 0o777;
        } finally {
            await fileHandle.close();
        }
    } catch (error) {
        if (allowMissing && isMissingFile(error)) return undefined;
        throw new Error(`Экспорт цветов: не удалось прочитать ${filePath}: ${errorMessage(error)}`, { cause: error });
    }

    try {
        return { text, json: JSON.parse(text), mode };
    } catch (error) {
        throw new Error(`Экспорт цветов: файл ${filePath} содержит неправильный JSON: ${errorMessage(error)}`, { cause: error });
    }
}

export async function readJsonFile(filePath: string): Promise<ReadJsonFileResult> {
    const result = await readJsonFileInternal(filePath, false);
    invariant(result !== undefined, `Экспорт цветов: файл ${filePath} неожиданно отсутствует`);
    return result;
}

/** Возвращает undefined только для действительно отсутствующего пути. */
export function readJsonFileIfExists(filePath: string): Promise<ReadJsonFileResult | undefined> {
    return readJsonFileInternal(filePath, true);
}

export function serializeJson(json: unknown): string {
    return `${JSON.stringify(json, null, '\t')}\n`;
}
