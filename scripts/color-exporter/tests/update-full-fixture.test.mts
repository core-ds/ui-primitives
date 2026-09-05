import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';

import { main } from '../tools/update-full-fixture.mjs';
import { sourceFile } from './test-paths.mjs';

async function setup(context: TestContext) {
    const root = await mkdtemp(path.join(tmpdir(), 'color-exporter-fixture-update-'));
    context.after(async () => rm(root, { recursive: true, force: true }));
    const fixture = sourceFile('tests', 'fixtures', 'full');
    const outputRoot = path.join(root, 'tests', 'fixtures', 'full');
    await cp(fixture, outputRoot, { recursive: true });
    const snapshotPath = path.join(root, 'snapshot.json');
    const snapshotText = await readFile(path.join(fixture, 'figma-sanitized.json'), 'utf8');
    await writeFile(snapshotPath, snapshotText, 'utf8');
    return {
        root,
        outputRoot,
        snapshotPath,
        snapshotText,
        argumentsList: [
            '--repo-root', path.join(fixture, 'repository'),
            '--output-root', outputRoot,
            '--source', 'snapshot',
            '--figma-json', snapshotPath,
        ],
    };
}

test('неверный новый цвет не изменяет прежний полный слепок', async (context) => {
    const fixture = await setup(context);
    const originalManifest = await readFile(path.join(fixture.outputRoot, 'manifest.json'), 'utf8');
    const snapshot = JSON.parse(fixture.snapshotText);
    const color = snapshot.document.children[0].children[0].children[0].children[0].fills[0].color;
    color.r = color.r === 0 ? 1 : 0;
    await writeFile(fixture.snapshotPath, JSON.stringify(snapshot), 'utf8');

    await assert.rejects(main(fixture.argumentsList), /не воспроизводит ожидаемые JSON/);
    assert.equal(await readFile(path.join(fixture.outputRoot, 'figma-sanitized.json'), 'utf8'), fixture.snapshotText);
    assert.equal(await readFile(path.join(fixture.outputRoot, 'manifest.json'), 'utf8'), originalManifest);
    assert.deepEqual(await readdir(path.dirname(fixture.outputRoot)), ['full']);
});

test('похожее имя папки и посторонние файлы не дают права удалить содержимое', async (context) => {
    const fixture = await setup(context);
    const wrongRoot = path.join(fixture.root, 'other', 'fixtures', 'full');
    await mkdir(wrongRoot, { recursive: true });
    const protectedFile = path.join(wrongRoot, 'important.txt');
    await writeFile(protectedFile, 'сохранить', 'utf8');
    const wrongArguments = fixture.argumentsList.map((value) => value === fixture.outputRoot ? wrongRoot : value);
    await assert.rejects(main(wrongArguments), /tests\/fixtures\/full/);
    assert.equal(await readFile(protectedFile, 'utf8'), 'сохранить');

    const extraFile = path.join(fixture.outputRoot, 'important.txt');
    await writeFile(extraFile, 'сохранить', 'utf8');
    await assert.rejects(main(fixture.argumentsList), /не соответствует структуре полного слепка/);
    assert.equal(await readFile(extraFile, 'utf8'), 'сохранить');
});

test('снимок обязан содержать каждую выбранную страницу', async (context) => {
    const fixture = await setup(context);
    const snapshot = JSON.parse(fixture.snapshotText);
    snapshot.document.children.pop();
    await writeFile(fixture.snapshotPath, JSON.stringify(snapshot), 'utf8');
    await assert.rejects(main(fixture.argumentsList), /должна встречаться ровно один раз/);
    assert.equal(await readFile(path.join(fixture.outputRoot, 'figma-sanitized.json'), 'utf8'), fixture.snapshotText);
});

test('пустой выбор и неполные результаты не могут подтвердить эталонный слепок', async (context) => {
    const fixture = await setup(context);
    await assert.rejects(
        main(fixture.argumentsList, { discover: async () => [] }),
        /нужна хотя бы одна палитра/,
    );
    await assert.rejects(
        main(fixture.argumentsList, { run: async () => [] }),
        /проверка слепка не охватила все выбранные палитры/,
    );
    assert.equal(await readFile(path.join(fixture.outputRoot, 'figma-sanitized.json'), 'utf8'), fixture.snapshotText);
});

test('неудачная установка нового каталога восстанавливает прежний слепок', async (context) => {
    const fixture = await setup(context);
    let calls = 0;
    const originalManifest = await readFile(path.join(fixture.outputRoot, 'manifest.json'), 'utf8');
    await assert.rejects(main(fixture.argumentsList, {
        rename: async (from, to) => {
            calls += 1;
            if (calls === 2) throw new Error('сбой установки каталога');
            return rename(from, to);
        },
    }), /сбой установки каталога/);
    assert.equal(calls, 3);
    assert.equal(await readFile(path.join(fixture.outputRoot, 'manifest.json'), 'utf8'), originalManifest);
    assert.deepEqual(await readdir(path.dirname(fixture.outputRoot)), ['full']);
});

test('символическая ссылка вместо каталога полного слепка запрещена', async (context) => {
    const fixture = await setup(context);
    const previous = path.join(fixture.root, 'protected-full');
    await rename(fixture.outputRoot, previous);
    await symlink(previous, fixture.outputRoot, 'dir');
    await assert.rejects(main(fixture.argumentsList), /не символической ссылкой/);
    assert.equal(await readFile(path.join(previous, 'figma-sanitized.json'), 'utf8'), fixture.snapshotText);
});

test('проверенный новый слепок заменяет прежний и удаляет временные папки', async (context) => {
    const fixture = await setup(context);
    await main(fixture.argumentsList);
    const manifest = JSON.parse(await readFile(path.join(fixture.outputRoot, 'manifest.json'), 'utf8'));
    assert.equal(manifest.source, 'snapshot');
    assert.equal(manifest.palettes.length, 10);
    assert.deepEqual(
        JSON.parse(await readFile(path.join(fixture.outputRoot, 'figma-sanitized.json'), 'utf8')),
        JSON.parse(fixture.snapshotText),
    );
    assert.deepEqual(await readdir(path.dirname(fixture.outputRoot)), ['full']);
});

test('при сбое восстановления прежняя копия остаётся на диске с путём в ошибке', async (context) => {
    const fixture = await setup(context);
    let calls = 0;
    await assert.rejects(main(fixture.argumentsList, {
        rename: async (from, to) => {
            calls += 1;
            if (calls > 1) throw new Error('переименование недоступно');
            return rename(from, to);
        },
    }), /копия сохранена в .*previous/);
    const retained = (await readdir(path.dirname(fixture.outputRoot))).find((name) => name.startsWith('.full-update-'));
    assert.ok(retained);
    assert.equal(await readFile(path.join(path.dirname(fixture.outputRoot), retained, 'previous', 'figma-sanitized.json'), 'utf8'), fixture.snapshotText);
});

test('первый проверенный слепок создаётся по точному пути без прежнего каталога', async (context) => {
    const fixture = await setup(context);
    const newRoot = path.join(fixture.root, 'new', 'tests', 'fixtures', 'full');
    await main(fixture.argumentsList.map((value) => value === fixture.outputRoot ? newRoot : value));
    const manifest = JSON.parse(await readFile(path.join(newRoot, 'manifest.json'), 'utf8'));
    assert.equal(manifest.palettes.length, 10);
    assert.deepEqual(await readdir(path.dirname(newRoot)), ['full']);
});
