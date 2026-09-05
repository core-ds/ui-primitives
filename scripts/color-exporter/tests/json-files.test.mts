import assert from 'node:assert/strict';
import {
    chmod,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    stat,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    assertSafeTargetPath,
    readJsonFile,
    serializeJson,
    writePreparedFiles,
} from '../src/core/json-files.mjs';

test('реальный путь JSON не может пройти через символическую ссылку', async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'color-exporter-path-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const repository = path.join(root, 'repo');
    const outside = path.join(root, 'outside');
    await mkdir(repository);
    await mkdir(outside);
    const externalJson = path.join(outside, 'colors_example.json');
    await writeFile(externalJson, '{}\n');
    await symlink(outside, path.join(repository, 'styles'));
    await assert.rejects(assertSafeTargetPath(repository, path.join(repository, 'styles/colors_example.json')), /не символической ссылкой/);
    await assertSafeTargetPath(root, externalJson);
    await assertSafeTargetPath(root, path.join(outside, 'colors_new.json'));
    await assert.rejects(assertSafeTargetPath(root, path.join(root, 'missing/colors_new.json')), /ENOENT/);
    const linkPath = path.join(repository, 'colors_example.json');
    await symlink(externalJson, linkPath);
    await assert.rejects(assertSafeTargetPath(root, linkPath), /не символической ссылкой/);
    await assert.rejects(readJsonFile(linkPath), /не удалось прочитать/);
    await assert.rejects(readJsonFile(outside), /обычным файлом/);
    assert.equal(await readFile(externalJson, 'utf8'), '{}\n');
});

test('JSON сериализуется табами и с одним конечным переводом строки', () => {
    assert.equal(serializeJson({ token: { value: 1 } }), '{\n\t"token": {\n\t\t"value": 1\n\t}\n}\n');
});

test('правильный JSON читается вместе с исходным текстом и правами', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'valid.json');
    try {
        await writeFile(targetPath, '{"valid":true}\n', 'utf8');
        await chmod(targetPath, 0o640);
        assert.deepEqual(await readJsonFile(targetPath), {
            text: '{"valid":true}\n',
            json: { valid: true },
            mode: 0o640,
        });
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('ошибка JSON содержит точный путь источника', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'broken.json');
    try {
        await writeFile(targetPath, '{', 'utf8');
        await assert.rejects(readJsonFile(targetPath), new RegExp(`файл ${targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} содержит неправильный JSON`));
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('ошибка чтения JSON содержит точный путь источника', async () => {
    const missingPath = path.join(tmpdir(), `color-exporter-missing-${process.pid}.json`);
    await rm(missingPath, { force: true });
    await assert.rejects(
        readJsonFile(missingPath),
        new RegExp(`не удалось прочитать ${missingPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
});

test('подготовленный файл заменяется целиком и сохраняет права', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'colors.json');
    const oldText = '{"old":true}\n';
    const nextText = '{"new":true}\n';
    try {
        await writeFile(targetPath, oldText, 'utf8');
        // Права 0666 обычно урезаются системной umask при создании нового
        // файла. Запись обязана восстановить их точно перед заменой.
        await chmod(targetPath, 0o666);
        await writePreparedFiles([{
            writeNeeded: true,
            targetPath,
            targetJson: 'styles/colors.json',
            oldText,
            nextText,
            mode: 0o666,
        }]);

        assert.equal(await readFile(targetPath, 'utf8'), nextText);
        assert.equal((await stat(targetPath)).mode & 0o777, 0o666);
        assert.deepEqual((await readdir(temporaryRoot)).filter((name) => name.includes('.color-exporter-')), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('новый JSON создаётся атомарно с заданными правами', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'colors_new.json');
    try {
        await writePreparedFiles([{
            writeNeeded: true,
            targetPath,
            targetJson: 'styles/colors_new.json',
            oldText: undefined,
            nextText: '{"new":true}\n',
            mode: 0o644,
        }]);

        assert.equal(await readFile(targetPath, 'utf8'), '{"new":true}\n');
        assert.equal((await stat(targetPath)).mode & 0o777, 0o644);
        assert.deepEqual((await readdir(temporaryRoot)).filter((name) => name.includes('.color-exporter-')), []);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('параллельно появившийся новый JSON не перезаписывается', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'colors_new.json');
    const foreignText = '{"foreign":true}\n';
    try {
        await writeFile(targetPath, foreignText, 'utf8');
        await assert.rejects(writePreparedFiles([{
            writeNeeded: true,
            targetPath,
            targetJson: 'styles/colors_new.json',
            oldText: undefined,
            nextText: '{"new":true}\n',
            mode: 0o644,
        }]), /появился во время синхронизации/);
        assert.equal(await readFile(targetPath, 'utf8'), foreignText);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('чужое изменение между чтением и записью не перезаписывается', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'colors.json');
    const oldText = '{"old":true}\n';
    const foreignText = '{"foreign":true}\n';
    try {
        await writeFile(targetPath, foreignText, 'utf8');
        await assert.rejects(
            writePreparedFiles([{
                writeNeeded: true,
                targetPath,
                targetJson: 'styles/colors.json',
                oldText,
                nextText: '{"new":true}\n',
                mode: 0o644,
            }]),
            /изменился во время синхронизации/,
        );
        assert.equal(await readFile(targetPath, 'utf8'), foreignText);
        assert.notEqual(foreignText, oldText);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('чужое изменение прав файла тоже считается гонкой', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'color-exporter-json-'));
    const targetPath = path.join(temporaryRoot, 'colors.json');
    const oldText = '{"old":true}\n';
    try {
        await writeFile(targetPath, oldText, 'utf8');
        await chmod(targetPath, 0o600);
        await assert.rejects(
            writePreparedFiles([{
                writeNeeded: true,
                targetPath,
                targetJson: 'styles/colors.json',
                oldText,
                nextText: '{"new":true}\n',
                mode: 0o644,
            }]),
            /изменился во время синхронизации/,
        );
        assert.equal((await stat(targetPath)).mode & 0o777, 0o600);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
});
