const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
    buildCatalog,
    CatalogError,
    crossProduct,
    loadAssetIndex,
    matchAssetTag,
    parseVariantProperties,
} = require('./catalog.cjs');
const { templateSource } = require('./generate.cjs');

const repo = path.resolve(__dirname, '../..');
const definitions = {
    Size: { type: 'VARIANT', variantOptions: ['20', '24'] },
    Style: { type: 'VARIANT', variantOptions: ['Default', 'Line'] },
};
const errorCode = (code) => (error) => error instanceof CatalogError && error.code === code;

test('properties come from exact Figma definitions, independent of key order', () => {
    assert.deepEqual(parseVariantProperties('Style=Line, Size=24', definitions), { Size: '24', Style: 'Line' });
    assert.deepEqual(parseVariantProperties('Size=24,Style=Default', definitions), { Size: '24', Style: 'Default' });
});
for (const name of [
    'Size=24',
    'Size=24, Style=line',
    'size=24, Style=Line',
    'Size=48, Style=Line',
    'Size=24, Size=24',
    'Size=24, Style=Line, Other=True',
]) {
    test(`rejects an incomplete or unknown property tuple: ${name}`, () =>
        assert.throws(() => parseVariantProperties(name, definitions), errorCode('variant-properties-unresolved')));
}
test('standalone components have one empty property tuple', () =>
    assert.deepEqual(parseVariantProperties('an exact standalone asset', {}), {}));
test('commas inside an enum option are not rewritten', () => {
    assert.deepEqual(
        parseVariantProperties('Mode=Large, Tall', { Mode: { type: 'VARIANT', variantOptions: ['Large, Tall'] } }),
        { Mode: 'Large, Tall' }
    );
});
test('ambiguous Figma property names fail closed', () => {
    const ambiguous = {
        A: { type: 'VARIANT', variantOptions: ['x', 'x, B=y'] },
        B: { type: 'VARIANT', variantOptions: ['z', 'y, B=z'] },
    };
    assert.throws(() => parseVariantProperties('A=x, B=y, B=z', ambiguous), errorCode('variant-properties-ambiguous'));
});
test('exposed non-variant properties require an explicit mapping', () =>
    assert.throws(
        () => parseVariantProperties('anything', { Label: { type: 'TEXT' } }),
        errorCode('non-variant-property')
    ));
test('large Cartesian products fail before generating arbitrary states', () =>
    assert.throws(
        () => crossProduct({ A: Array.from({ length: 40 }, String), B: Array.from({ length: 40 }, String) }),
        errorCode('state-space-too-large')
    ));

const asset = {
    web: 'ExactIcon',
    middle: 'glyph-26_exact-line_24',
    webComponent: "import { ExactIcon } from '@alfalab/icons-glyph-26/ExactIcon';",
};
const index = new Map([
    ['glyph-26\0glyph-26_exact-line_24', asset],
    ['android\0android_exact_m', { middle: 'android_exact_m' }],
]);
test('asset match uses the exact source tag and package', () =>
    assert.equal(matchAssetTag(['glyph-26_exact-line_24'], index, 'glyph-26'), asset));
for (const tags of [['glyph_26_exact-line_24'], ['glyph-26_exact_line_24'], ['Glyph-26_exact-line_24']]) {
    test(`does not normalize an asset identifier: ${tags[0]}`, () =>
        assert.throws(() => matchAssetTag(tags, index, 'glyph-26'), errorCode('asset-not-in-ui-metadata')));
}
test('matching another package is forbidden', () =>
    assert.throws(
        () => matchAssetTag(['glyph-26_exact-line_24'], index, 'glyph'),
        errorCode('asset-not-in-ui-metadata')
    ));
test('missing and multiple source tags are explicit exclusions', () => {
    assert.throws(() => matchAssetTag([], index, 'glyph-26'), errorCode('asset-tag-missing'));
    assert.throws(
        () => matchAssetTag(['glyph-26_exact-line_24', 'unknown'], index, 'glyph-26'),
        errorCode('asset-tag-ambiguous')
    );
});
test('an asset without a web contract does not acquire an invented export', () =>
    assert.throws(() => matchAssetTag(['android_exact_m'], index, 'android'), errorCode('web-export-missing')));

const assets = loadAssetIndex(repo);
const sourceAsset = assets.index.get('glyph-26\0glyph-26_arrow-left_24');
const fileKey = 'ZcdUPebEhHfSZ91zgmv2cK';
const baseline = { schemaVersion: 1, figmaFileKey: fileKey, sets: [] };
const root = {
    id: '1:1',
    name: 'synthetic exact source fixture',
    type: 'COMPONENT_SET',
    key: 'a'.repeat(40),
    publish: 'CURRENT',
    definitions: { Size: { type: 'VARIANT', defaultValue: '24', variantOptions: ['20', '24'] } },
    variants: [
        { id: '1:2', name: 'Size=24', key: 'b'.repeat(40), assetTags: [sourceAsset.middle], width: 24, height: 24 },
    ],
};
const capture = (current = root) => ({
    fileKey,
    retrievedAt: '2026-10-30T00:00:00.000Z',
    pages: [{ pageId: '9:1', pageName: 'glyph-26', total: 1, rows: [current] }],
    errors: [],
});
const build = (input = capture(), existing = baseline, options = {}) =>
    buildCatalog(input, existing, { repo, assets, ...options });

test('exact live tuple becomes a binding with source identity and a guarded absent state', () => {
    const result = build();
    assert.equal(result.sets.length, 1);
    assert.equal(result.sets[0].variants[0].export, sourceAsset.web);
    assert.equal(result.sets[0].variants[0].figmaNodeId, '1:2');
    assert.equal(result.sets[0].variants[0].componentKey, root.variants[0].key);
    assert.equal(result.sets[0].unsupported[0].reasonCode, 'no-figma-variant');
    assert.equal(result.sources.partial, false);
});
test('a 32px source remains 32px', () => {
    const current = structuredClone(root);
    current.definitions.Size.variantOptions = ['32'];
    Object.assign(current.variants[0], {
        name: 'Size=32',
        assetTags: ['glyph-26_action-qr-scan-line_32'],
        width: 32,
        height: 32,
    });
    assert.equal(build(capture(current)).sets[0].variants[0].size, 32);
});
for (const [reason, patch] of [
    ['figma-svg-geometry-mismatch', { width: 20 }],
    ['figma-geometry-missing', { width: undefined }],
    ['asset-tag-missing', { assetTags: [] }],
    ['asset-tag-ambiguous', { assetTags: [sourceAsset.middle, sourceAsset.middle] }],
]) {
    test(`a source conflict is counted and never substituted: ${reason}`, () => {
        const current = structuredClone(root);
        Object.assign(current.variants[0], patch);
        const result = build(capture(current));
        assert.equal(result.sets.length, 0);
        assert.equal(result.coverage.reasonCounts[reason], 1);
    });
}
test('two variants with the same tuple do not silently overwrite each other', () => {
    const current = structuredClone(root);
    current.variants.push({ ...current.variants[0], id: '1:3' });
    const result = build(capture(current));
    assert.equal(result.sets.length, 0);
    assert.equal(result.coverage.reasonCounts['duplicate-variant-state'], 1);
});
for (const [publish, reason] of [
    ['UNPUBLISHED', 'not-published'],
    ['CHANGED', 'unpublished-local-changes'],
]) {
    test(`unpublished source state is kept out of generated bindings: ${publish}`, () => {
        const result = build(capture({ ...root, publish }));
        assert.equal(result.sets.length, 0);
        assert.equal(result.coverage.reasonCounts[reason], 1);
    });
}
test('existing maintained identity and behavior remain intact', () => {
    const previous = {
        ...build().sets[0],
        generated: undefined,
        id: 'maintained-id',
        template: 'code-connect/icons/Maintained.figma.ts',
    };
    const result = build(capture(), { ...baseline, sets: [previous] });
    assert.equal(result.sets[0].id, 'maintained-id');
    assert.equal(result.sets[0].template, previous.template);
    assert.deepEqual(result.sets[0].properties, previous.properties);
    assert.deepEqual(result.sets[0].unsupported, previous.unsupported);
    assert.equal(result.coverage.generatedRoots, 0);
});
test('partial source reads reconcile with explicit unread inventory IDs', () => {
    const input = capture();
    input.pages[0].total = 2;
    input.errors.push({ job: { ids: ['1:9'] } });
    const inventory = [
        {
            pageId: '9:1',
            pageName: 'glyph-26',
            total: 2,
            rows: [
                { id: '1:1', name: root.name },
                { id: '1:9', name: 'unread root' },
            ],
        },
    ];
    assert.throws(() => build(input), errorCode('partial-capture-requires-inventory'));
    const result = build(input, baseline, { inventory });
    assert.equal(result.coverage.expectedRoots, 2);
    assert.equal(result.coverage.scannedRoots, 1);
    assert.equal(result.coverage.unreadRoots, 1);
    assert.equal(result.coverage.reasonCounts['figma-source-not-read'], 1);
    assert.equal(result.sources.partial, true);
});
test('a retry preserves old source dates and records fresh dates per root', () => {
    const originalDate = '2026-10-30T00:00:00.000Z';
    const retryDate = '2026-10-31T01:00:00.000Z';
    const completedDate = '2026-10-31T01:10:00.000Z';
    const previous = { ...build().sets[0], generated: undefined, id: 'maintained-id' };
    const input = capture();
    const newer = structuredClone(root);
    newer.id = '1:3';
    newer.variants[0].id = '1:4';
    newer.retrievedAt = retryDate;
    const unpublished = { ...structuredClone(newer), id: '1:5', publish: 'UNPUBLISHED' };
    input.pages[0].rows.push(newer, unpublished);
    input.pages[0].total = 3;
    input.retryCompletedAt = completedDate;
    const result = build(input, { ...baseline, sets: [previous] });
    assert.equal(result.sets.find((set) => set.figmaNodeId === '1:1').provenance.retrievedAt, originalDate);
    assert.equal(result.sets.find((set) => set.figmaNodeId === '1:3').provenance.retrievedAt, retryDate);
    assert.equal(result.sources.retrievedAt, originalDate);
    assert.equal(result.sources.retryCompletedAt, completedDate);
    assert.deepEqual(result.sources.readPeriods, [
        { retrievedAt: originalDate, roots: 1 },
        { retrievedAt: retryDate, roots: 2 },
    ]);
});
test('invalid explicit root dates are not silently replaced by the original date', () => {
    for (const retrievedAt of ['', 'not-a-date', null, 123]) {
        assert.throws(() => build(capture({ ...root, retrievedAt })), /Invalid retrievedAt for Figma root/);
    }
});
test('a retry completion date must be valid when supplied', () => {
    assert.throws(() => build({ ...capture(), retryCompletedAt: '' }), /retryCompletedAt must be a valid timestamp/);
});
test('generated code uses exact tuple data and explicit rejection', () => {
    const set = build().sets[0];
    const source = templateSource(set, fileKey);
    assert(source.includes(sourceAsset.web));
    assert(source.includes('getEnum("Size", {"20":"20","24":"24"})'));
    assert(source.includes('if (!selected)'));
    assert(source.includes('svgSize: selected.size'));
    assert(!source.includes('Icon20Adapter'));
});
