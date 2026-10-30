const assert = require('node:assert/strict');
const path = require('node:path');

const nodeId = /^\d+:\d+$/;
const componentKey = /^[a-f0-9]{40}$/;
const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyKey = (properties) => JSON.stringify(Object.entries(properties).sort(([a], [b]) => a.localeCompare(b)));

function unknownValue(values) {
    let candidate = '<unknown>';
    while (values.includes(candidate)) candidate += '!';
    return candidate;
}

function crossProduct(properties, limit = 4096) {
    const count = Object.values(properties).reduce((total, values) => total * values.length, 1);
    assert(count <= limit, `Variant state space exceeds the explicit check limit (${limit})`);
    return Object.entries(properties).reduce(
        (rows, [name, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value }))),
        [{}]
    );
}

function record(value, message) {
    assert(value && typeof value === 'object' && !Array.isArray(value), message);
}

function localPath(value, prefix, extension) {
    assert.equal(typeof value, 'string');
    assert(!path.isAbsolute(value), 'Repository paths must be relative');
    assert(!value.split(/[\\/]/).includes('..'), 'Repository paths cannot escape their owner');
    assert(value.startsWith(prefix) && value.endsWith(extension), 'Unexpected repository path');
}

function validateProvenance(set) {
    if (!set.generated && !set.provenance) return;
    record(set.provenance, 'Generated bindings must declare Figma provenance');
    const source = set.provenance;
    assert.match(source.componentKey, componentKey, 'Missing component-set identity');
    assert.match(source.pageId, nodeId, 'Missing source page identity');
    assert.equal(typeof source.pageName, 'string');
    assert(source.pageName.length > 0);
    assert.equal(source.publishStatus, 'CURRENT', 'New bindings require a current published source');
    assert.equal(typeof source.retrievedAt, 'string');
    assert(Number.isFinite(Date.parse(source.retrievedAt)), 'Missing source observation date');
    record(source.propertyDefinitions, 'Missing observed property definitions');
    assert.deepEqual(
        Object.keys(source.propertyDefinitions).sort(),
        Object.keys(set.properties).sort(),
        'Source properties differ'
    );
    for (const [name, definition] of Object.entries(source.propertyDefinitions)) {
        assert.equal(definition.type, 'VARIANT', 'An unsupported source property was silently omitted');
        assert(Array.isArray(definition.variantOptions));
        assert.deepEqual([...definition.variantOptions].sort(), [...set.properties[name]].sort());
        assert(set.properties[name].includes(definition.defaultValue), 'Unknown source default');
    }
    const ids = new Set();
    const keys = new Set();
    for (const variant of set.variants) {
        assert.match(variant.figmaNodeId, nodeId, 'Missing variant identity');
        assert.match(variant.componentKey, componentKey, 'Missing variant component key');
        assert(!ids.has(variant.figmaNodeId), 'Variant identity is repeated');
        assert(!keys.has(variant.componentKey), 'Variant component key is repeated');
        ids.add(variant.figmaNodeId);
        keys.add(variant.componentKey);
        assert.equal(variant.sourceAssetTag, path.basename(variant.svg, '.svg'), 'The exact source tag changed');
    }
}

function validateManifest(manifest) {
    assert.equal(manifest.schemaVersion, 1);
    assert.match(manifest.figmaFileKey, /^[A-Za-z0-9]+$/);
    assert(Array.isArray(manifest.sets) && manifest.sets.length > 0, 'The catalog must not be empty');
    const sourceIds = new Set();
    const ids = new Set();
    const files = new Set();
    for (const set of manifest.sets) {
        assert.equal(typeof set.name, 'string');
        assert(set.name.length > 0);
        assert.equal(typeof set.id, 'string');
        assert(set.id.length > 0);
        assert.match(set.figmaNodeId, nodeId);
        assert(!sourceIds.has(set.figmaNodeId), 'A Figma source is connected twice');
        assert(!ids.has(set.id), 'A Code Connect id is connected twice');
        localPath(set.template, 'code-connect/icons/', '.figma.ts');
        assert(!files.has(set.template), 'A template is included twice');
        sourceIds.add(set.figmaNodeId);
        ids.add(set.id);
        files.add(set.template);
        assert.match(set.package, /^@alfalab\/icons-[a-z0-9-]+$/);
        assert.match(set.sourceDirectory, /^packages\/[a-z0-9-]+\/src$/);
        record(set.properties, 'Figma properties must be a record');
        for (const values of Object.values(set.properties)) {
            assert(Array.isArray(values) && values.length > 0, 'An enum must declare values');
            assert(values.every((value) => typeof value === 'string'));
            assert.equal(new Set(values).size, values.length, 'An enum value is repeated');
        }
        assert(Array.isArray(set.variants) && set.variants.length > 0, 'A binding needs an observed supported variant');
        assert(Array.isArray(set.unsupported));
        for (const variant of [...set.variants, ...set.unsupported]) {
            record(variant.properties, 'Variant properties must be a record');
            assert.deepEqual(
                Object.keys(variant.properties).sort(),
                Object.keys(set.properties).sort(),
                'Incomplete variant tuple'
            );
            for (const [name, value] of Object.entries(variant.properties)) {
                assert.equal(typeof value, 'string');
                assert(set.properties[name].includes(value), 'Unknown Figma enum value');
            }
        }
        const states = [...set.variants, ...set.unsupported].map((variant) => propertyKey(variant.properties));
        assert.equal(new Set(states).size, states.length, 'A state is mapped twice');
        assert.deepEqual(states.sort(), crossProduct(set.properties).map(propertyKey).sort(), 'Missing Figma state');
        for (const variant of set.variants) {
            assert.match(variant.export, identifier, 'Invalid React export identifier');
            localPath(variant.svg, 'icons/', '.svg');
            assert(Number.isInteger(variant.size) && variant.size > 0, 'A native square SVG size is required');
        }
        for (const variant of set.unsupported) {
            assert.equal(typeof variant.reason, 'string');
            assert(variant.reason.length > 0, 'An unsupported state needs a reason');
            if (variant.missingExport !== undefined) assert.match(variant.missingExport, identifier);
        }
        validateProvenance(set);
    }
}

function svgGeometry(source) {
    const root = source.match(/<svg\b[^>]*>/)?.[0];
    assert(root, 'Missing SVG root');
    const attribute = (name) => {
        const value = root.match(new RegExp(`\\b${name}=(?:"([^"]+)"|'([^']+)'|\\{([0-9.]+)\\})`));
        assert(value, `Missing literal SVG ${name}`);
        return value[1] ?? value[2] ?? value[3];
    };
    const scalar = (name) => {
        const value = attribute(name);
        assert(/^[0-9]+(?:\.[0-9]+)?(?:px)?$/.test(value), 'SVG dimensions must be explicit pixel values');
        const number = Number(value.replace(/px$/, ''));
        assert(Number.isFinite(number) && number > 0);
        return number;
    };
    const viewBox = attribute('viewBox')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    assert.equal(viewBox.length, 4);
    assert(viewBox.every(Number.isFinite));
    return { width: scalar('width'), height: scalar('height'), viewBox };
}

module.exports = { validateManifest, validateProvenance, propertyKey, crossProduct, svgGeometry, unknownValue };
