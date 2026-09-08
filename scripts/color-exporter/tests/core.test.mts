import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, stat, symlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { prepare, writePlans, fetchFigma } from '../src/sync.mjs';
import { readLocal } from '../src/files.mjs';
import { main } from '../src/cli.mjs';
import { paint, rectangle, frame, section, page, document, temporary } from './fixtures.mjs';

const run = (children = [section()], old?: string, name = 'colors_example.json') => prepare(document(page(name, children)), async () => old);
const values = async (children = [section()], old?: string, name?: string) => JSON.parse((await run(children, old, name))[0]!.text);

test('Каждое поле: режим, inverted, вложенное семейство и особенности десяти наборов', async () => {
    const cases = [
        ['example', 'dark/accent_inverted', 'primary', 'hover', 'dark_accent_primary_inverted_hover', 'accent_inverted/primary/hover', 'accentColorPrimaryInvertedHover'],
        ['bluetint', 'light/accent', 'primary', 'default', 'light_accent_primary', 'accent/primary', 'accentColorPrimary'],
        ['bluetint', 'static_accent_inverted', 'primary', 'press', 'static_accent_primary_inverted_press', 'static_accent_inverted/primary/press', 'staticAccentColorPrimaryInvertedPress'],
        ['brand', 'static_brand', 'primary', 'default', 'static_brand_primary', 'static_brand/primary', 'staticBrandColorPrimary'],
        ['decorative', 'light/decorative-soft', 'blue', 'press', 'light_decorative_soft_blue_press', 'decorative-soft/blue/press', 'decorativeSoftColorBluePress'],
        ['go', 'dark/go', 'primary', 'default', 'dark_go_primary', 'go/primary', 'goColorPrimary'],
        ['monochrome', 'light/monochrome-black_inverted', '10', 'default', 'light_monochrome_black_10_inverted', 'monochrome-black_inverted/10', 'monochromeBlackColor10Inverted'],
        ['promo', 'light/promo-muted', 'primary', 'hover', 'light_promo_muted_primary_hover', 'promo-muted/primary/hover', 'promoMutedColorPrimaryHover'],
        ['qualitative', 'dark/qualitative-duocolor/set-c', '1', 'default', 'dark_qualitative_duocolor_set_c_1', 'qualitative-duocolor/set-c/1', 'qualitativeDuocolorSetCColor1'],
        ['sequential', 'light/sequential-red', '1', 'default', 'light_sequential_red_1', 'sequential-red/1', 'sequentialRedColor1'],
        ['students', 'static_students', 'primary', 'default', 'static_students_primary', 'static_students/primary', 'staticStudentsColorPrimary'],
        ['x5', 'static/brand', 'primary', 'default', 'static_brand_primary', 'static/brand/primary', 'staticBrandColorPrimary'],
        ['example', 'light/accent', 'hover', 'default', 'light_accent_hover', 'accent/hover', 'accentColorHover'],
        ['example', 'light/accent_inverted/nested', 'primary', 'press', 'light_accent_inverted_nested_primary_press', 'accent_inverted/nested/primary/press', 'accentNestedColorPrimaryInvertedPress'],
        ['example', 'light/--/foo', 'primary', 'default', 'light____foo_primary', '--/foo/primary', 'FooColorPrimary'],
    ];
    for (const [palette, family, token, state, key, figma, alias] of cases) {
        const result = await values([section(family, [frame(token, [rectangle(state)])])], undefined, `colors_${palette}.json`);
        assert.deepEqual(result, { [key!]: { rgba: 'rgba(239, 49, 36, 1)', hex: '#ef3124', figma, web: `--color-${key!.replaceAll('_', '-')}`, alias } });
    }
});

test('empty ничего не меняет: любые непустые подмножества состояний', async () => {
    for (const states of [['default'], ['hover'], ['press'], ['default', 'hover'], ['default', 'press'], ['hover', 'press'], ['default', 'hover', 'press']]) {
        const rectangles = states.map(state => rectangle(state));
        const withEmpty = [rectangle('empty', { fills: null }), ...rectangles.flatMap(item => [item, rectangle('empty', { opacity: null })])];
        assert.deepEqual(await values([section('light/a', [frame('b', rectangles)])]), await values([section('light/a', [frame('b', withEmpty)])]));
    }
});

test('Привязки и ARGB: цвет, прозрачность заливки и прямоугольника', async () => {
    const binding = { type: 'VARIABLE_ALIAS', id: 'variable:1' };
    for (const fields of [
        { boundVariables: { fills: [binding] }, styles: undefined },
        { fills: [{ ...paint, boundVariables: { color: binding } }], styles: undefined },
        { styles: { fill: 'style:1' } },
    ]) assert.equal(Object.keys(await values([section('light/a', [frame('b', [rectangle('default', fields)])])])).length, 1);
    const result = await values([section('light/a', [frame('b', [rectangle('default', { opacity: 0.5, fills: [{ ...paint, opacity: 0.5, color: { ...paint.color, a: 0.5 } }] })])])]);
    assert.equal(result.light_a_b.rgba, 'rgba(239, 49, 36, 0.13)');
    assert.equal(result.light_a_b.hex, '#21ef3124');
});

test('Ошибки внешних данных не маскируются и не превращаются в пустой экспорт', async () => {
    const badPaints = [[], [paint, { ...paint, visible: false }], [{ ...paint, visible: false }], [{ type: 'GRADIENT_LINEAR' }], [{ ...paint, color: { r: -1, g: 0, b: 0 } }], [{ ...paint, opacity: null }]];
    const badFields = badPaints.map(fills => ({ fills }));
    const badRectangles = [...badFields, { styles: undefined }, { styles: { fill: '' } }, { opacity: null }, { boundVariables: { fills: [] } }, { fills: [{ ...paint, boundVariables: { color: {} } }] }];
    for (const fields of badRectangles) await assert.rejects(run([section('light/a', [frame('b', [rectangle('default', fields)])])]));
    for (const states of [[], ['empty'], ['unknown'], ['press', 'hover'], ['hover', 'hover']]) {
        await assert.rejects(run([section('light/a', [frame('b', states.map(state => rectangle(state)))])]));
    }
    for (const source of [null, {}, { document: {} }, document(page(), page()), document(page('colors_bad.json', [])), document(page('colors_bad.json', [frame()]))]) {
        await assert.rejects(prepare(source, async () => undefined));
    }
    for (const name of ['light/static_a', 'light/light_a', 'dark/dark_a', 'light_a', 'static/a']) await assert.rejects(run([section(name)]));
    for (const old of ['{', 'null', '[]', '{"a":1}', '{"1":{}}']) await assert.rejects(run(undefined, old));
    await assert.rejects(prepare(document(page()), async () => undefined, 'missing'));
});

test('Правила наборов ограничивают состояния и имена', async () => {
    for (const [palette, family, name] of [['brand', 'static_brand', 'red'], ['decorative', 'light/decorative', 'red'], ['decorative', 'dark/decorative-text', 'blue'], ['promo', 'static_promo', 'a'], ['monochrome', 'light/monochrome-black', '10'], ['go', 'static_go', 'a'], ['x5', 'static/brand', 'a'], ['students', 'static_students', 'a'], ['sequential', 'light/sequential-red', '1'], ['qualitative', 'light/qualitative-flexible', '1']]) {
        await assert.rejects(run([section(family, [frame(name, [rectangle('press')])])], undefined, `colors_${palette}.json`));
    }
    await assert.rejects(run([section('static_monochrome-black', [frame('word')])], undefined, 'colors_monochrome.json'));
});

test('Два источника одного значения в коде запрещены; совпавшие цвета допустимы', async () => {
    for (const sections of [
        [section('light/a-b'), section('light/a_b')],
        [section('light/a', [frame('x-1', [rectangle('default', { id: 'first' })]), frame('x--1', [rectangle('default', { id: 'second' })])])],
    ]) await assert.rejects(run(sections), /Два источника.* и /);
    await assert.rejects(run([section('light/a', [frame(), frame()])]), /повторяются имена/);
    await assert.rejects(run([section('light/a_inverted/b_inverted')]), /inverted указан несколько раз/);
    assert.equal(Object.keys(await values([section('light/a'), section('dark/a')])).length, 2);
    assert.equal((await prepare(document(page('colors_a.json'), page('colors_b.json')), async () => undefined)).length, 2);
});

test('Активные и устаревшие сортируются отдельно; возвращённый токен оживает', async () => {
    const old = JSON.stringify({ z: { hex: '#123', deprecated: false, alias: 'old' }, _a: { deprecated: true, custom: 1 }, light_accent_primary: { deprecated: true } });
    const [plan] = await run(undefined, old);
    const result = JSON.parse(plan!.text);
    assert.deepEqual(Object.keys(result), ['light_accent_primary', '_a', 'z']);
    assert.deepEqual(result.z, { hex: '#123', alias: 'old', deprecated: true });
    assert.deepEqual(Object.keys(result._a), ['deprecated', 'custom']);
    assert.deepEqual(Object.keys(result.light_accent_primary), ['rgba', 'hex', 'figma', 'web', 'alias']);
    assert.deepEqual(plan!.deprecated, ['z']);
    assert.equal((await run(undefined, plan!.text))[0]!.text, plan!.text);
});

test('Новые страницы, отсутствие страницы, повтор, режим проверки и безопасная запись', async t => {
    const root = await temporary(t);
    await writeFile(join(root, 'styles/colors_absent.json'), 'сломанный JSON');
    const source = document(page(), page('colors_new.json'));
    const plans = await prepare(source, path => readLocal(root, path));
    await assert.rejects(stat(join(root, plans[0]!.path)), { code: 'ENOENT' });
    await writePlans(root, plans, true);
    const first = await stat(join(root, plans[0]!.path));
    const repeat = await prepare(source, path => readLocal(root, path));
    await writePlans(root, repeat, true);
    assert.equal((await stat(join(root, plans[0]!.path))).mtimeMs, first.mtimeMs);
    assert(repeat.every(plan => plan.before === plan.text));
    await writeFile(join(root, 'snapshot.json'), JSON.stringify(source));
    const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
    execFileSync(process.execPath, [cli, '--repo-root', root, '--figma-json', join(root, 'snapshot.json'), '--check']);
    const oldBytes = await readFile(join(root, plans[0]!.path), 'utf8');
    await assert.rejects(prepare(document(page(), page('colors_new.json', [section('light/a', [frame('x-1'), frame('x--1')])])), path => readLocal(root, path)));
    assert.equal(await readFile(join(root, plans[0]!.path), 'utf8'), oldBytes);
    await writeFile(join(root, plans[0]!.path), 'чужая правка');
    await assert.rejects(writePlans(root, repeat, true), /изменился после чтения/);
    await symlink(join(root, plans[0]!.path), join(root, 'styles/colors_link.json'));
    await assert.rejects(readLocal(root, 'styles/colors_link.json'));
    await assert.rejects(readLocal(root, '../outside'));
    await chmod(join(root, plans[0]!.path), 0o755);
    await writePlans(root, plans);
    assert.equal((await stat(join(root, plans[0]!.path))).mode & 0o777, 0o755);
});

test('REST: повторы, Retry-After, запрет перенаправлений и отсутствие секрета в ошибках', async () => {
    let calls = 0;
    const delays: number[] = [];
    const request: typeof fetch = async (url, options) => {
        assert.equal(String(url), 'https://api.figma.com/v1/files/JGR9GpDXUneyYHfDdb7BDT');
        assert.equal(options?.redirect, 'error');
        return ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : Response.json(document());
    };
    const pause = async (delay?: number) => { delays.push(delay!); };
    assert.deepEqual(await fetchFigma('secret', request, pause), document());
    assert.deepEqual(delays, [2000]);
    calls = 0;
    await assert.rejects(fetchFigma('secret', async () => { calls++; throw Error('secret'); }, pause), /секрет скрыт/);
    assert.equal(calls, 3);
    for (const response of [new Response('', { status: 403 }), new Response('{', { status: 200 }), new Response('', { status: 429, headers: { 'retry-after': '60' } })]) {
        calls = 0;
        await assert.rejects(fetchFigma('secret', async () => { calls++; return response; }, pause));
        assert.equal(calls, 1);
    }
    await assert.rejects(fetchFigma(''));
});

test('Перехваченная ошибка возвращает пакет; чужая правка останавливает откат и сохраняет копии', async t => {
    for (const foreign of [false, true]) {
        const root = await temporary(t);
        const a = join(root, 'styles/colors_a.json');
        await writeFile(a, 'исходник');
        const plans = await prepare(document(page('colors_a.json'), page('colors_b.json')), async () => undefined);
        const originalLink = fs.link;
        fs.link = async () => {
            if (foreign) await writeFile(a, 'чужая правка');
            throw Error('сбой второй записи');
        };
        syncBuiltinESMExports();
        try { await assert.rejects(writePlans(root, plans), foreign ? /Неполный откат/ : /сбой второй записи/); }
        finally { fs.link = originalLink; syncBuiltinESMExports(); }
        assert.equal(await readFile(a, 'utf8'), foreign ? 'чужая правка' : 'исходник');
        const backups = (await fs.readdir(join(root, 'styles'))).filter(name => name.startsWith('.color-exporter-'));
        assert.equal(backups.length, foreign ? 1 : 0);
        if (foreign) assert.equal(await readFile(join(root, 'styles', backups[0]!, '0.old'), 'utf8'), 'исходник');
    }
});

test('Параметры CLI: помощь и отказ до чтения Figma', async () => {
    assert.equal(await main(['--help']), 0);
    for (const args of [[], ['--wrong'], ['--check', '--check'], ['--repo-root']]) await assert.rejects(main(args));
});

test('Разовая ошибка чтения после замены не мешает вернуть исходный файл', async t => {
    const root = await temporary(t);
    const path = join(root, 'styles/colors_example.json');
    await writeFile(path, 'исходник');
    const originalOpen = fs.open;
    let reads = 0;
    fs.open = async (...args) => {
        if (++reads === 3) throw Error('разовая ошибка чтения');
        return originalOpen(...args);
    };
    syncBuiltinESMExports();
    try { await assert.rejects(writePlans(root, await run()), /разовая ошибка чтения/); }
    finally { fs.open = originalOpen; syncBuiltinESMExports(); }
    assert.equal(await readFile(path, 'utf8'), 'исходник');
});

test('Релизный фильтр учитывает только корневые ассеты, а не удалённые тестовые снимки', async () => {
    const script = await readFile(new URL('../../../utils/ci.sh', import.meta.url), 'utf8');
    const filters = [...script.matchAll(/grep -E "([^"]+)"/g)].map(match => new RegExp(match[1]!));
    assert.equal(filters.length, 2);
    for (const filter of filters) for (const prefix of ['icons', 'styles', 'animations']) {
        assert(filter.test(`${prefix}/example.json`));
        assert(!filter.test(`scripts/color-exporter/tests/${prefix}/example.json`));
    }
});
