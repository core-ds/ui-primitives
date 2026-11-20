const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');

const repo = path.resolve(__dirname, '../..');
const generatedDirectory = 'code-connect/icons/generated';
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function validateSet(set) {
    assert(set.generated === true);
    assert(/^\d+:\d+$/.test(set.figmaNodeId));
    const pack = /^@alfalab\/icons-([a-z0-9-]+)$/.exec(set.package)?.[1];
    assert(pack);
    assert.equal(set.sourceDirectory, `packages/${pack}/src`);
    assert.equal(set.template, `${generatedDirectory}/${pack}/${set.figmaNodeId.replace(':', '-')}.figma.ts`);
    assert(set.variants.length > 0);
    assert.equal(set.provenance.publishStatus, 'CURRENT');
    for (const variant of set.variants) {
        assert(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(variant.export));
        assert(Number.isInteger(variant.size) && variant.size > 0);
    }
}

function templateSource(set, fileKey) {
    validateSet(set);
    const names = Object.keys(set.properties).sort(compare);
    const table = {};
    for (const variant of set.variants) {
        const state = names.map((name) => variant.properties[name]);
        assert(state.every((value) => typeof value === 'string'));
        const key = JSON.stringify(state);
        assert(!Object.hasOwn(table, key), 'Generated states must be unique');
        table[key] = { component: variant.export, size: variant.size };
    }
    const selections = names.map((name) => {
        const identity = Object.fromEntries(set.properties[name].map((value) => [value, value]));
        return `instance.getEnum(${JSON.stringify(name)}, ${JSON.stringify(identity)})`;
    });
    return [
        `// url=https://www.figma.com/design/${fileKey}/Icons?node-id=${set.figmaNodeId.replace(':', '-')}`,
        `// source=https://github.com/core-ds/ui-primitives/tree/master/${set.sourceDirectory}`,
        `// component=${[...new Set(set.variants.map((variant) => variant.export))].sort(compare).join(' / ')}`,
        '// Generated from code-connect/icons/manifest.json. Run pnpm figma:connect:generate.',
        "import figma from 'figma';",
        '',
        'const instance = figma.selectedInstance;',
        `const state: Array<string | undefined> = [${selections.join(', ')}];`,
        'if (state.some((value) => value === undefined)) {',
        `    throw new Error(${JSON.stringify(`${set.name}: неизвестные или отсутствующие свойства Figma`)});`,
        '}',
        `const variants: Record<string, { component: string; size: number }> = ${JSON.stringify(table)};`,
        'const selected = variants[JSON.stringify(state)];',
        'if (!selected) {',
        `    throw new Error(${JSON.stringify(`${set.name}: точное соответствие выбранного варианта не подтверждено`)});`,
        '}',
        'const component = selected.component;',
        "const imports = [`import { ${component} } from '" + set.package + "/${component}';`];",
        '',
        'export default {',
        `    id: ${JSON.stringify(set.id)},`,
        '    imports,',
        '    example: figma.code`<${component} />`,',
        '    metadata: { nestable: true, props: { svgSize: selected.size, imports } },',
        '};',
        '',
    ].join('\n');
}

function generatedFiles(directory) {
    const absolute = path.join(repo, directory);
    if (!fs.existsSync(absolute)) return [];
    const result = [];
    for (const item of fs.readdirSync(absolute, { withFileTypes: true })) {
        assert(!item.isSymbolicLink(), 'Generated template directory must not contain symlinks');
        const file = `${directory}/${item.name}`;
        if (item.isDirectory()) result.push(...generatedFiles(file));
        else if (item.isFile() && item.name.endsWith('.figma.ts')) result.push(file);
    }
    return result;
}

async function generate(options = {}) {
    const check = Boolean(options.check);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'code-connect/icons/manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1);
    assert(/^[A-Za-z0-9]+$/.test(manifest.figmaFileKey));
    const paths = manifest.sets.map((set) => set.template);
    assert.equal(new Set(paths).size, paths.length);
    assert.equal(new Set(manifest.sets.map((set) => set.id)).size, paths.length);
    assert.equal(new Set(manifest.sets.map((set) => set.figmaNodeId)).size, paths.length);
    const config = JSON.parse(fs.readFileSync(path.join(repo, 'figma.config.json'), 'utf8'));
    const tsconfig = JSON.parse(fs.readFileSync(path.join(repo, 'tsconfig.code-connect.json'), 'utf8'));
    const expected = new Map();
    const configuration = (await prettier.resolveConfig(path.join(repo, 'package.json'))) || {};
    const format = (source, relative) =>
        prettier.format(source, { ...configuration, filepath: path.join(repo, relative) });
    for (const set of manifest.sets) {
        if (set.generated)
            expected.set(set.template, await format(templateSource(set, manifest.figmaFileKey), set.template));
        else assert(fs.existsSync(path.join(repo, set.template)), `Missing maintained template: ${set.template}`);
    }
    config.codeConnect.include = paths;
    tsconfig.include = paths;
    expected.set('figma.config.json', await format(JSON.stringify(config), 'figma.config.json'));
    expected.set('tsconfig.code-connect.json', await format(JSON.stringify(tsconfig), 'tsconfig.code-connect.json'));
    const stale = generatedFiles(generatedDirectory).filter((file) => !expected.has(file));
    const differences = [...expected]
        .filter(
            ([file, source]) =>
                !fs.existsSync(path.join(repo, file)) || fs.readFileSync(path.join(repo, file), 'utf8') !== source
        )
        .map(([file]) => file);
    if (check) {
        assert.equal(stale.length, 0, `Unregistered generated templates: ${stale.join(', ')}`);
        assert.equal(differences.length, 0, `Generated files differ from the manifest: ${differences.join(', ')}`);
    } else {
        for (const file of stale) fs.unlinkSync(path.join(repo, file));
        for (const file of differences) {
            fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
            fs.writeFileSync(path.join(repo, file), expected.get(file));
        }
    }
    return {
        check,
        templates: paths.length,
        generatedTemplates: manifest.sets.filter((set) => set.generated).length,
        changedFiles: differences.length,
        staleFiles: stale.length,
    };
}

module.exports = { generate, templateSource };
if (require.main === module) {
    const args = process.argv.slice(2);
    assert(
        args.length === 0 || (args.length === 1 && args[0] === '--check'),
        'Usage: node scripts/code-connect/generate.cjs [--check]'
    );
    generate({ check: args.includes('--check') })
        .then((result) => console.log(JSON.stringify(result)))
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
}
