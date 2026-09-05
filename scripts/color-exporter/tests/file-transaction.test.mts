import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { writePreparedFiles, type FileOperations } from '../src/core/file-transaction.mjs';
import type { WritablePreparedFile } from '../src/core/types.mjs';

async function fixture(t: TestContext, newFile = false) {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'color-exporter-transaction-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const files: WritablePreparedFile[] = ['first', 'second'].map((name) => ({
        targetPath: path.join(root, `${name}.json`), targetJson: `styles/${name}.json`,
        oldText: newFile ? undefined : '{"old":true}\n', nextText: '{"new":true}\n',
        mode: 0o640, writeNeeded: true,
    }));
    for (const file of files) {
        if (file.oldText !== undefined) {
            await fs.writeFile(file.targetPath, file.oldText);
            await fs.chmod(file.targetPath, file.mode);
        }
    }
    const [first, second] = files;
    assert.ok(first && second);
    return { root, files, first, second };
}

test('сбой подготовки дожидается остальных записей до очистки временных файлов', async (t) => {
    const { root, files, first, second } = await fixture(t, true);
    const gate = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    let finished = false;
    const operation = writePreparedFiles(files, {
        ...fs,
        async writeFile(filePath, data, options) {
            if (String(filePath).startsWith(first.targetPath)) throw new Error('первый файл недоступен');
            assert.ok(String(filePath).startsWith(second.targetPath));
            started.resolve();
            await gate.promise;
            return fs.writeFile(filePath, data, options);
        },
    }).finally(() => { finished = true; });
    const rejection = assert.rejects(operation, /первый файл недоступен/);
    await started.promise;
    assert.equal(finished, false);
    gate.resolve();
    await rejection;
    assert.deepEqual(await fs.readdir(root), []);
});

test('несколько ошибок подготовки сохраняются вместе и не меняют цели', async (t) => {
    const { files, root } = await fixture(t, true);
    await assert.rejects(writePreparedFiles(files, {
        ...fs, async writeFile() { throw new Error('диск недоступен'); },
    }), (error: unknown) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 2);
        return true;
    });
    assert.deepEqual(await fs.readdir(root), []);
});

test('сбой второй замены восстанавливает первый JSON вместе с правами', async (t) => {
    const { files, first, second, root } = await fixture(t);
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async rename(from, to) {
            if (to === second.targetPath) throw new Error('вторая замена недоступна');
            return fs.rename(from, to);
        },
    }), /вторая замена недоступна/);
    for (const file of files) {
        assert.equal(await fs.readFile(file.targetPath, 'utf8'), file.oldText);
        assert.equal((await fs.stat(file.targetPath)).mode & 0o777, file.mode);
    }
    assert.deepEqual((await fs.readdir(root)).sort(), [path.basename(first.targetPath), path.basename(second.targetPath)]);
});

test('созданный JSON удаляется при сбое следующего создания', async (t) => {
    const { files, second, root } = await fixture(t, true);
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async link(from, to) {
            if (to === second.targetPath) throw new Error('второй путь недоступен');
            return fs.link(from, to);
        },
    }), /второй путь недоступен/);
    assert.deepEqual(await fs.readdir(root), []);
});

test('изменение цели во время подготовки обнаруживается перед установкой', async (t) => {
    const { files, first } = await fixture(t);
    const foreign = '{"foreign":true}\n';
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async chmod(filePath, mode) {
            await fs.chmod(filePath, mode);
            await fs.writeFile(first.targetPath, foreign);
        },
    }), /изменился во время синхронизации/);
    assert.equal(await fs.readFile(first.targetPath, 'utf8'), foreign);
});

test('неудачное восстановление сохраняет чужую версию и полную резервную копию', async (t) => {
    const { files, first, second, root } = await fixture(t);
    const foreign = '{"foreign":true}\n';
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async rename(from, to) {
            if (to === second.targetPath) {
                // Запись в тот же inode: одной проверки номера файла недостаточно.
                await fs.writeFile(first.targetPath, foreign);
                throw new Error('вторая замена недоступна');
            }
            return fs.rename(from, to);
        },
    }), (error: unknown) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 2);
        assert.match(String(error.errors[1]), /исходный текст:.*rollback.tmp/);
        assert.match(error.message, /чужая версия сохранена.*исходный текст:.*rollback.tmp/);
        return true;
    });
    assert.equal(await fs.readFile(first.targetPath, 'utf8'), foreign);
    const backups = (await fs.readdir(root)).filter((name) => name.endsWith('.rollback.tmp'));
    assert.equal(backups.length, 1);
    assert.equal(await fs.readFile(path.join(root, backups[0]!), 'utf8'), first.oldText);
});

test('неудачный rename при восстановлении тоже оставляет исходный текст', async (t) => {
    const { files, second, root, first } = await fixture(t);
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async rename(from, to) {
            if (to === second.targetPath || String(from).endsWith('.rollback.tmp')) throw new Error('rename недоступен');
            return fs.rename(from, to);
        },
    }), AggregateError);
    assert.equal(await fs.readFile(first.targetPath, 'utf8'), first.nextText);
    const backup = (await fs.readdir(root)).find((name) => name.endsWith('.rollback.tmp'));
    assert.ok(backup);
    assert.equal(await fs.readFile(path.join(root, backup), 'utf8'), first.oldText);
});

test('чужая версия нового файла не удаляется при восстановлении', async (t) => {
    const { files, first, second } = await fixture(t, true);
    const foreign = '{"foreign":true}\n';
    await assert.rejects(writePreparedFiles(files, {
        ...fs,
        async link(from, to) {
            if (to === second.targetPath) {
                await fs.unlink(first.targetPath);
                await fs.writeFile(first.targetPath, foreign);
                throw new Error('вторая ссылка недоступна');
            }
            return fs.link(from, to);
        },
    }), AggregateError);
    assert.equal(await fs.readFile(first.targetPath, 'utf8'), foreign);
});

test('ошибка очистки сообщается вызывающему коду, а не скрывается', async (t) => {
    const { files } = await fixture(t, true);
    await assert.rejects(writePreparedFiles(files.slice(0, 1), {
        ...fs,
        async unlink(filePath) {
            if (!String(filePath).endsWith('.rollback.tmp')) throw new Error('очистка недоступна');
            return fs.unlink(filePath);
        },
    }), /очистка недоступна/);
});

test('неизвестная ошибка чтения не превращается в отсутствующий файл', async (t) => {
    const { files } = await fixture(t);
    const io: FileOperations = { ...fs, async lstat() { throw new Error('чтение недоступно'); } };
    await assert.rejects(writePreparedFiles(files, io), /чтение недоступно/);
});

test('цель-ссылка отклоняется без изменения файла назначения', async (t) => {
    const { files, first, second } = await fixture(t);
    await fs.unlink(first.targetPath);
    await fs.symlink(second.targetPath, first.targetPath);
    await assert.rejects(writePreparedFiles(files), /обычным файлом, не ссылкой/);
    assert.equal(await fs.readFile(second.targetPath, 'utf8'), second.oldText);
});
