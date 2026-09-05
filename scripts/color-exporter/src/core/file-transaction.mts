import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';

import { invariant } from './assertions.mjs';
import type { WritablePreparedFile } from './types.mjs';

/** Узкая граница файловой системы позволяет проверять настоящие сбои записи. */
export type FileOperations = Pick<typeof fs, 'writeFile' | 'readFile' | 'chmod' | 'lstat' | 'link' | 'rename' | 'unlink'>;

interface PendingFile {
    run: WritablePreparedFile;
    temporaryPath: string;
    rollbackPath: string;
    installedIdentity?: { dev: number; ino: number };
    preserveRollback: boolean;
}

function isMissingFile(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function throwFailures(errors: readonly unknown[], message: string): void {
    if (errors.length === 1) throw errors[0];
    // GitHub и командная строка могут показать только message/stack. Поэтому
    // пути восстановления видны и без специального разбора AggregateError.errors.
    if (errors.length > 1) throw new AggregateError(errors, `${message}:\n${errors.map(errorMessage).join('\n')}`);
}

function validatePreparedRuns(preparedRuns: readonly WritablePreparedFile[]): void {
    invariant(Array.isArray(preparedRuns), 'подготовленные файлы должны быть массивом');
    const targetPaths = new Set<string>();
    for (const run of preparedRuns) {
        invariant(run && typeof run === 'object', 'подготовленный файл должен быть объектом');
        invariant(typeof run.targetPath === 'string' && path.isAbsolute(run.targetPath), 'целевой путь должен быть абсолютным');
        invariant(!targetPaths.has(run.targetPath), `целевой путь ${run.targetPath} повторяется`);
        invariant(typeof run.targetJson === 'string' && run.targetJson.length > 0, 'у подготовленного файла нет targetJson');
        invariant(run.oldText === undefined || typeof run.oldText === 'string', `${run.targetJson}: исходный текст должен быть строкой или отсутствовать`);
        invariant(typeof run.nextText === 'string', `${run.targetJson}: новый текст обязателен`);
        invariant(typeof run.writeNeeded === 'boolean', `${run.targetJson}: writeNeeded должен быть логическим`);
        invariant(run.writeNeeded === (run.oldText === undefined || run.oldText !== run.nextText), `${run.targetJson}: writeNeeded не совпадает с текстами`);
        invariant(Number.isInteger(run.mode) && run.mode >= 0 && run.mode <= 0o777, `${run.targetJson}: недопустимые права файла`);
        targetPaths.add(run.targetPath);
    }
}

async function readCurrent(targetPath: string, io: FileOperations) {
    let stats;
    try {
        stats = await io.lstat(targetPath);
    } catch (error) {
        if (isMissingFile(error)) return undefined;
        throw error;
    }
    invariant(stats.isFile(), `цель ${targetPath} должна быть обычным файлом, не ссылкой`);
    return { text: await io.readFile(targetPath, 'utf8'), mode: stats.mode & 0o777, dev: stats.dev, ino: stats.ino };
}

async function assertUnchanged(run: WritablePreparedFile, io: FileOperations): Promise<void> {
    const current = await readCurrent(run.targetPath, io);
    if (run.oldText === undefined) {
        invariant(current === undefined, `файл ${run.targetJson} появился во время синхронизации`);
    } else {
        invariant(current?.text === run.oldText && current.mode === run.mode, `файл ${run.targetJson} изменился во время синхронизации`);
    }
}

async function writeTemporary(filePath: string, text: string, mode: number, io: FileOperations): Promise<void> {
    // До завершения записи файл доступен только владельцу. chmod восстанавливает
    // точные права исходного JSON независимо от системной umask.
    await io.writeFile(filePath, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await io.chmod(filePath, mode);
}

async function stageAll(pending: readonly PendingFile[], io: FileOperations): Promise<void> {
    // Promise.all завершился бы при первой ошибке, пока соседние записи ещё идут.
    // Очистка началась бы слишком рано и оставила запоздало созданные файлы.
    const results = await Promise.allSettled(pending.flatMap(({ run, temporaryPath, rollbackPath }) => [
        writeTemporary(temporaryPath, run.nextText, run.mode, io),
        ...(run.oldText === undefined ? [] : [writeTemporary(rollbackPath, run.oldText, run.mode, io)]),
    ]));
    const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    throwFailures(failures, 'Экспорт цветов: не удалось подготовить временные файлы');
}

async function install(file: PendingFile, io: FileOperations): Promise<void> {
    const { run, temporaryPath } = file;
    await assertUnchanged(run, io);
    const stats = await io.lstat(temporaryPath);
    if (run.oldText === undefined) {
        // Создание ссылки, в отличие от rename, не перезапишет появившийся путь.
        await io.link(temporaryPath, run.targetPath);
    } else {
        await io.rename(temporaryPath, run.targetPath);
    }
    file.installedIdentity = { dev: stats.dev, ino: stats.ino };
}

async function restore(file: PendingFile, io: FileOperations): Promise<void> {
    const { run } = file;
    if (run.oldText !== undefined) {
        // При неудачном восстановлении оставляем исходный текст для ручного
        // восстановления. Не удаляем единственную копию в блоке очистки.
        file.preserveRollback = true;
    }
    const current = await readCurrent(run.targetPath, io);
    invariant(
        current !== undefined
            && current.dev === file.installedIdentity?.dev && current.ino === file.installedIdentity.ino
            && current.text === run.nextText && current.mode === run.mode,
        `файл ${run.targetJson} изменился до восстановления; чужая версия сохранена`,
    );
    if (run.oldText === undefined) await io.unlink(run.targetPath);
    else await io.rename(file.rollbackPath, run.targetPath);
    file.preserveRollback = false;
}

async function removeTemporary(filePath: string, io: FileOperations): Promise<void> {
    try {
        await io.unlink(filePath);
    } catch (error) {
        if (!isMissingFile(error)) throw error;
    }
}

/**
 * Подготовка → замена → восстановление при перехваченной ошибке → очистка.
 * Каждая замена атомарна, но весь набор не является транзакцией ОС: аварийное
 * завершение процесса и конкурентная запись в последний момент требуют
 * отдельной изолированной рабочей папки. В GitHub Actions она есть у задания.
 */
export async function writePreparedFiles(
    preparedRuns: readonly WritablePreparedFile[],
    io: FileOperations = fs,
): Promise<void> {
    validatePreparedRuns(preparedRuns);
    const pending: PendingFile[] = preparedRuns.filter((run) => run.writeNeeded).map((run) => {
        const prefix = `${run.targetPath}.color-exporter-${randomUUID()}`;
        return { run, temporaryPath: `${prefix}.tmp`, rollbackPath: `${prefix}.rollback.tmp`, preserveRollback: false };
    });
    const errors: unknown[] = [];
    try {
        await Promise.all(pending.map(({ run }) => assertUnchanged(run, io)));
        await stageAll(pending, io);
        for (const file of pending) await install(file, io);
    } catch (error) {
        errors.push(error);
        for (const file of pending.filter((item) => item.installedIdentity !== undefined).reverse()) {
            try {
                await restore(file, io);
            } catch (rollbackError) {
                const recovery = file.preserveRollback ? `; исходный текст: ${file.rollbackPath}` : '';
                errors.push(new Error(`Экспорт цветов: не удалось восстановить ${file.run.targetJson}: ${errorMessage(rollbackError)}${recovery}`, { cause: rollbackError }));
            }
        }
    }

    const cleanup = await Promise.allSettled(pending.flatMap((file) => [
        removeTemporary(file.temporaryPath, io),
        ...(file.preserveRollback ? [] : [removeTemporary(file.rollbackPath, io)]),
    ]));
    for (const result of cleanup) if (result.status === 'rejected') errors.push(result.reason);
    throwFailures(errors, 'Экспорт цветов: запись, восстановление или очистка завершились ошибками');
}
