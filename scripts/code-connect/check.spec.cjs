const assert = require('node:assert/strict');
const test = require('node:test');
const { validateManifest, svgGeometry, crossProduct, unknownValue } = require('./validation.cjs');

function fixture() {
    return {
        schemaVersion: 1,
        figmaFileKey: 'FixtureFile',
        sets: [
            {
                name: 'Fixture',
                template: 'code-connect/icons/generated/fixture/1-1.figma.ts',
                id: 'fixture-1-1',
                figmaNodeId: '1:1',
                package: '@alfalab/icons-fixture',
                sourceDirectory: 'packages/fixture/src',
                generated: true,
                properties: { Size: ['32'], Color: ['True', 'False'] },
                variants: [
                    {
                        properties: { Size: '32', Color: 'True' },
                        export: 'Fixture32ColorIcon',
                        svg: 'icons/fixture/fixture_32_color.svg',
                        size: 32,
                        figmaNodeId: '1:2',
                        componentKey: 'b'.repeat(40),
                        sourceAssetTag: 'fixture_32_color',
                    },
                ],
                unsupported: [{ properties: { Size: '32', Color: 'False' }, reason: 'No observed Figma variant' }],
                provenance: {
                    componentKey: 'a'.repeat(40),
                    pageId: '0:1',
                    pageName: 'fixture',
                    publishStatus: 'CURRENT',
                    retrievedAt: '2026-10-30T00:00:00Z',
                    propertyDefinitions: {
                        Size: { type: 'VARIANT', defaultValue: '32', variantOptions: ['32'] },
                        Color: { type: 'VARIANT', defaultValue: 'True', variantOptions: ['True', 'False'] },
                    },
                },
            },
        ],
    };
}

test('accepts an observed 32px colored variant and explicit gaps without an invented export', () =>
    validateManifest(fixture()));
test('accepts standalone components without variant axes', () => {
    const value = fixture(),
        set = value.sets[0];
    set.properties = {};
    set.variants[0].properties = {};
    set.unsupported = [];
    set.provenance.propertyDefinitions = {};
    validateManifest(value);
});
test('rejects duplicate Figma sources even when ids and files differ', () => {
    const value = fixture(),
        extra = structuredClone(value.sets[0]);
    extra.id = 'another';
    extra.template = 'code-connect/icons/generated/fixture/another.figma.ts';
    value.sets.push(extra);
    assert.throws(() => validateManifest(value), /Figma source is connected twice/);
});
test('rejects duplicate or incomplete state tuples', () => {
    const duplicate = fixture();
    duplicate.sets[0].unsupported.push(structuredClone(duplicate.sets[0].unsupported[0]));
    assert.throws(() => validateManifest(duplicate), /state is mapped twice/);
    const missing = fixture();
    missing.sets[0].unsupported = [];
    assert.throws(() => validateManifest(missing), /Missing Figma state/);
});
test('requires current published provenance for generated bindings', () => {
    const missing = fixture();
    delete missing.sets[0].provenance;
    assert.throws(() => validateManifest(missing), /declare Figma provenance/);
    const changed = fixture();
    changed.sets[0].provenance.publishStatus = 'CHANGED';
    assert.throws(() => validateManifest(changed), /current published source/);
});
test('rejects discarded source properties and invented enum options', () => {
    const extra = fixture();
    extra.sets[0].provenance.propertyDefinitions.Label = { type: 'TEXT', defaultValue: 'Label' };
    assert.throws(() => validateManifest(extra), /Source properties differ/);
    const option = fixture();
    option.sets[0].provenance.propertyDefinitions.Color.variantOptions.push('Other');
    assert.throws(() => validateManifest(option));
});
test('rejects inferred asset tags and malformed source identities', () => {
    const tag = fixture();
    tag.sets[0].variants[0].sourceAssetTag = 'fixture-32-color';
    assert.throws(() => validateManifest(tag), /exact source tag changed/);
    const key = fixture();
    key.sets[0].provenance.componentKey = 'guessed-key';
    assert.throws(() => validateManifest(key), /component-set identity/);
    const variant = fixture();
    delete variant.sets[0].variants[0].figmaNodeId;
    assert.throws(() => validateManifest(variant));
});
test('rejects path traversal and invalid React export identifiers', () => {
    const escape = fixture();
    escape.sets[0].template = 'code-connect/icons/../../foreign.figma.ts';
    assert.throws(() => validateManifest(escape), /cannot escape/);
    const name = fixture();
    name.sets[0].variants[0].export = 'Fixture;Other';
    assert.throws(() => validateManifest(name), /Invalid React export identifier/);
});
test('chooses an invalid-state sentinel outside actual source options', () => {
    assert.equal(unknownValue(['<unknown>', '<unknown>!']), '<unknown>!!');
});
test('bounds exhaustive state checks instead of silently truncating them', () => {
    assert.throws(() => crossProduct({ A: Array(65).fill('a'), B: Array(65).fill('b') }), /explicit check limit/);
});
test('reads literal SVG/JSX geometry without accepting dynamic or relative dimensions', () => {
    assert.deepEqual(svgGeometry('<svg width="32" height={32} viewBox="0,0,32,32">'), {
        width: 32,
        height: 32,
        viewBox: [0, 0, 32, 32],
    });
    assert.throws(() => svgGeometry('<svg width="100%" height="32" viewBox="0 0 32 32">'), /explicit pixel/);
    assert.throws(() => svgGeometry('<svg width={size} height="32" viewBox="0 0 32 32">'), /Missing literal SVG/);
});
