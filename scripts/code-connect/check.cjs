const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const repo = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'code-connect/icons/manifest.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(repo, 'figma.config.json'), 'utf8')).codeConnect;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-primitives-code-connect-'));
const environment = { ...process.env };
delete environment.FIGMA_ACCESS_TOKEN;

function run(args) {
    try {
        return execFileSync(process.execPath, args, {
            cwd: repo,
            env: environment,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
    } catch (error) {
        if (error.stdout) process.stdout.write(error.stdout);
        if (error.stderr) process.stderr.write(error.stderr);
        throw error;
    }
}

function evaluate(set, properties) {
    const source = fs.readFileSync(path.join(repo, set.template), 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
    }).outputText;
    const figma = {
        selectedInstance: {
            getEnum(name, values) {
                const value = properties[name];
                return typeof value === 'string' && Object.hasOwn(values, value) ? values[value] : undefined;
            },
        },
        code(parts, ...values) {
            return parts.flatMap((part, index) => [part, values[index] ?? '']);
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(transpiled, {
        module,
        exports: module.exports,
        require(name) {
            assert.equal(name, 'figma', 'Leaf templates must depend only on the Figma runtime');
            return figma;
        },
    });
    return module.exports.default;
}

function declaration(set, variant) {
    return `import { ${variant.export} } from '${set.package}/${variant.export}';`;
}

function verifyResult(set, variant, result) {
    assert.equal(result.id, set.id);
    assert.equal(result.metadata.nestable, true);
    assert.equal(result.metadata.props.svgSize, variant.size, 'The selected SVG size was changed');
    assert.deepEqual(
        Array.from(result.imports),
        [declaration(set, variant)],
        'The selected icon family/export changed'
    );
    assert.deepEqual(
        Array.from(result.metadata.props.imports),
        [declaration(set, variant)],
        'Nested imports were lost'
    );
    assert.equal(result.example.join(''), `<${variant.export} />`);
}

function svgGeometry(source) {
    const root = source.match(/<svg\b[^>]*>/)?.[0];
    assert(root, 'Missing SVG root');
    return Object.fromEntries(
        ['width', 'height', 'viewBox'].map((name) => [name, root.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]])
    );
}

function crossProduct(properties) {
    return Object.entries(properties).reduce(
        (rows, [name, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value }))),
        [{}]
    );
}

function propertyKey(properties) {
    return JSON.stringify(Object.entries(properties).sort(([left], [right]) => left.localeCompare(right)));
}

const compilerOptions = {
    target: ts.ScriptTarget.ES2021,
    lib: ['lib.es2021.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: [],
    paths: {
        '@alfalab/icons-glyph/*': [path.join(repo, 'packages/glyph/src/*')],
        '@alfalab/icons-glyph-26/*': [path.join(repo, 'packages/glyph-26/src/*')],
        react: [path.join(repo, 'node_modules/@types/react/index.d.ts')],
        'react/*': [path.join(repo, 'node_modules/@types/react/*')],
    },
};

function diagnostics(files) {
    return ts.getPreEmitDiagnostics(ts.createProgram(files, compilerOptions));
}

try {
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.sets.length, 5);
    assert.equal(config.label, 'React');
    assert.equal(config.language, 'tsx');
    assert.deepEqual(
        config.include,
        manifest.sets.map((set) => set.template)
    );
    assert.equal(new Set(config.include).size, 5);
    assert.equal(new Set(manifest.sets.map((set) => set.id)).size, 5);

    run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.code-connect.json']);
    const parsedFile = path.join(temporary, 'parsed.json');
    run([
        'node_modules/@figma/code-connect/bin/figma',
        'connect',
        'parse',
        '--config',
        'figma.config.json',
        '--skip-update-check',
        '--exit-on-unreadable-files',
        '--outFile',
        parsedFile,
    ]);
    const parsed = JSON.parse(fs.readFileSync(parsedFile, 'utf8'));
    assert.equal(parsed.length, 5);
    const parsedIdentities = new Set();
    for (const item of parsed) {
        assert.equal(item.templateData.isParserless, true);
        assert.equal(item.label, 'React');
        assert(item.template.trim());
        const url = new URL(item.figmaNode);
        assert.equal(url.pathname.split('/')[2], manifest.figmaFileKey);
        parsedIdentities.add(url.searchParams.get('node-id').replace('-', ':'));
    }
    assert.deepEqual([...parsedIdentities].sort(), manifest.sets.map((set) => set.figmaNodeId).sort());

    let cases = 0;
    let rejected = 0;
    const examples = [];
    for (const set of manifest.sets) {
        const packageFile = JSON.parse(
            fs.readFileSync(path.join(repo, set.sourceDirectory, '../package.json'), 'utf8')
        );
        assert.equal(packageFile.name, set.package);
        const source = fs.readFileSync(path.join(repo, set.template), 'utf8');
        const url = new URL(source.match(/^\/\/ url=(\S+)/m)[1]);
        assert.equal(url.pathname.split('/')[2], manifest.figmaFileKey);
        assert.equal(url.searchParams.get('node-id').replace('-', ':'), set.figmaNodeId);
        assert(
            source.includes(`// source=https://github.com/core-ds/ui-primitives/tree/master/${set.sourceDirectory}`)
        );
        assert(set.template.endsWith('.figma.ts'));

        const declared = [...set.variants, ...set.unsupported].map((variant) => propertyKey(variant.properties));
        assert.equal(new Set(declared).size, declared.length, 'A state is mapped twice');
        assert.deepEqual(declared.sort(), crossProduct(set.properties).map(propertyKey).sort(), 'Missing Figma state');
        for (const variant of set.variants) {
            const expectedGeometry = {
                width: String(variant.size),
                height: String(variant.size),
                viewBox: `0 0 ${variant.size} ${variant.size}`,
            };
            const svg = fs.readFileSync(path.join(repo, variant.svg), 'utf8');
            assert.deepEqual(svgGeometry(svg), expectedGeometry);
            const reactSource = fs.readFileSync(path.join(repo, set.sourceDirectory, variant.export + '.tsx'), 'utf8');
            assert(reactSource.includes(`export const ${variant.export} =`));
            assert.deepEqual(svgGeometry(reactSource), expectedGeometry);
            const result = evaluate(set, variant.properties);
            verifyResult(set, variant, result);
            const file = path.join(temporary, `example-${examples.length}.tsx`);
            fs.writeFileSync(
                file,
                result.imports.join('\n') +
                    '\nexport default function Example() { return (' +
                    result.example.join('') +
                    '); }\n'
            );
            examples.push(file);
            cases++;
        }
        for (const variant of set.unsupported) {
            assert.equal(typeof variant.missingExport, 'string');
            assert(
                !fs.existsSync(path.join(repo, set.sourceDirectory, variant.missingExport + '.tsx')),
                `${set.name}: unsupported state has acquired an exact export; update its mapping`
            );
        }
        const invalid = set.unsupported.map((variant) => variant.properties);
        for (const name of Object.keys(set.properties)) {
            invalid.push({ ...set.variants[0].properties, [name]: '<unknown>' });
            const missing = { ...set.variants[0].properties };
            delete missing[name];
            invalid.push(missing);
        }
        if (set.properties.Color) invalid.push({ ...set.variants[0].properties, Color: false });
        for (const properties of invalid) {
            assert.throws(() => evaluate(set, properties), undefined, `${set.name} accepted an unsupported state`);
            cases++;
            rejected++;
        }
    }
    assert.equal(examples.length, 19);
    const actual = diagnostics(examples);
    if (actual.length) {
        throw new Error(
            ts.formatDiagnosticsWithColorAndContext(actual, {
                getCanonicalFileName: (file) => file,
                getCurrentDirectory: () => repo,
                getNewLine: () => '\n',
            })
        );
    }

    const firstSet = manifest.sets[0];
    const firstVariant = firstSet.variants[0];
    const valid = evaluate(firstSet, firstVariant.properties);
    const wrongFamily = evaluate(firstSet, firstVariant.properties);
    wrongFamily.imports = [declaration(firstSet, firstVariant).replace('icons-glyph-26/', 'icons-glyph/')];
    assert.throws(() => verifyResult(firstSet, firstVariant, wrongFamily));
    const wrongSize = evaluate(firstSet, firstVariant.properties);
    wrongSize.metadata.props.svgSize = firstVariant.size + 4;
    assert.throws(() => verifyResult(firstSet, firstVariant, wrongSize));
    const lostMetadataImport = evaluate(firstSet, firstVariant.properties);
    lostMetadataImport.metadata.props.imports = [];
    assert.throws(() => verifyResult(firstSet, firstVariant, lostMetadataImport));
    const brokenFile = path.join(temporary, 'missing-import.tsx');
    fs.writeFileSync(brokenFile, 'export default function Example() { return (' + valid.example.join('') + '); }\n');
    assert(
        diagnostics([brokenFile]).some(
            (item) =>
                item.code === 2304 &&
                ts.flattenDiagnosticMessageText(item.messageText, ' ').includes(firstVariant.export)
        )
    );

    console.log(
        JSON.stringify({
            templates: parsed.length,
            cases,
            renderedSnippets: examples.length,
            rejectedStates: rejected,
            sourceSvgGeometry: 'passed',
            workspaceReactGeometry: 'passed',
            workspaceApiTypes: 'passed',
            negativeControls: {
                family: 'detected',
                size: 'detected',
                metadataImport: 'detected',
                jsxImport: 'detected',
            },
            publishedNpmApiChecked: false,
            networkRequests: 0,
            figmaPublication: false,
        })
    );
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
