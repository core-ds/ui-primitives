import { constants, type Stats } from 'node:fs';
import { lstat, open, mkdtemp, writeFile, rename, link, unlink, rm, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { TARGET, requireValue } from './contract.mjs';
import type { Plan } from './sync.mjs';

type Snapshot = { text: string; mode: number; version: string };
const version = (stat: Stats) => `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.mode}`;

/** Не следуем по ссылкам и не зависаем при подмене файла именованным каналом. */
async function snapshot(root: string, path: string): Promise<Snapshot | undefined> {
    requireValue(TARGET.test(path), `Недопустимый путь ${path}`);
    requireValue((await lstat(join(root, 'styles'))).isDirectory(), 'styles должна быть настоящей папкой');
    try {
        const file = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
            const stat = await file.stat();
            requireValue(stat.isFile(), `${path}: ожидался обычный файл`);
            return { text: await file.readFile('utf8'), mode: stat.mode & 0o777, version: version(stat) };
        } finally { await file.close(); }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

export async function readLocal(root: string, path: string): Promise<string | undefined> {
    return (await snapshot(root, path))?.text;
}

/**
 * Сначала готовим все файлы, затем заменяем. При перехваченной ошибке возвращаем
 * собственные изменения. Питание/kill и параллельный редактор требуют отдельной копии репозитория.
 */
export async function writePlans(repoRoot: string, plans: Plan[], compareBaseline = false): Promise<void> {
    const root = resolve(repoRoot);
    const pending = [];
    for (const plan of plans) {
        const old = await snapshot(root, plan.path);
        if (compareBaseline) requireValue(old?.text === plan.before, `${plan.path}: файл изменился после чтения`);
        if (old?.text !== plan.text) pending.push({ plan, old });
    }
    if (!pending.length) return;
    const directory = await mkdtemp(join(root, 'styles/.color-exporter-'));
    const written: { path: string; old: Snapshot | undefined; installed: Snapshot; backup: string }[] = [];
    let keepBackup = false;
    try {
        for (const [index, { plan, old }] of pending.entries()) {
            await writeFile(join(directory, `${index}.new`), plan.text, { flag: 'wx', mode: old?.mode ?? 0o644 });
            await chmod(join(directory, `${index}.new`), old?.mode ?? 0o644);
            if (old) {
                await writeFile(join(directory, `${index}.old`), old.text, { flag: 'wx', mode: old.mode });
                await chmod(join(directory, `${index}.old`), old.mode);
            }
        }
        for (const [index, { plan, old }] of pending.entries()) {
            const current = await snapshot(root, plan.path);
            requireValue(current?.version === old?.version && current?.text === old?.text, `${plan.path}: конкурентное изменение`);
            const target = join(root, plan.path);
            const temporary = join(directory, `${index}.new`);
            const stat = await lstat(temporary);
            const installed = { text: plan.text, mode: stat.mode & 0o777, version: version(stat) };
            const record = { path: plan.path, old, installed, backup: join(directory, `${index}.old`) };
            // link создаёт новый путь только при его отсутствии; rename заменяет существующий атомарно.
            if (old) await rename(temporary, target);
            else await link(temporary, target);
            written.push(record);
            requireValue((await snapshot(root, plan.path))?.version === installed.version, `${plan.path}: подмена после записи`);
        }
    } catch (error) {
        const errors: unknown[] = [error];
        for (const record of written.reverse()) {
            try {
                const current = await snapshot(root, record.path);
                requireValue(current?.version === record.installed.version && current.text === record.installed.text, `${record.path}: откат не должен затирать чужую правку`);
                if (record.old) await rename(record.backup, join(root, record.path));
                else await unlink(join(root, record.path));
            } catch (rollbackError) { errors.push(rollbackError); }
        }
        keepBackup = errors.length > 1;
        if (keepBackup) throw new AggregateError(errors, `Неполный откат; резервные копии: ${directory}`);
        throw error;
    } finally {
        if (!keepBackup) await rm(directory, { recursive: true, force: true });
    }
}
