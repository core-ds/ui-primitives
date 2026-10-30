const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PACKS = Object.freeze({
    'general (glyph)': 'glyph',
    'glyph-26': 'glyph-26',
    rocky: 'rocky',
    ios: 'ios',
    android: 'android',
    corp: 'corp',
    invest: 'invest',
    site: 'site',
});
const MAX_STATES = 1000;
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

class CatalogError extends Error {
    constructor(code, message) {
        super(message || code);
        this.code = code;
    }
}

function fail(code, message) {
    throw new CatalogError(code, message);
}

function propertyKey(properties) {
    return JSON.stringify(Object.entries(properties).sort(([left], [right]) => compare(left, right)));
}

function crossProduct(properties) {
    let rows = [{}];
    for (const [name, values] of Object.entries(properties)) {
        if (rows.length * values.length > MAX_STATES) fail('state-space-too-large');
        rows = rows.flatMap((row) => values.map((value) => ({ ...row, [name]: value })));
    }
    return rows;
}

function enumProperties(definitions) {
    if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) fail('missing-definitions');
    const properties = {};
    for (const name of Object.keys(definitions).sort(compare)) {
        const definition = definitions[name];
        if (definition.type !== 'VARIANT') fail('non-variant-property');
        const values = definition.variantOptions;
        if (
            !Array.isArray(values) ||
            values.length === 0 ||
            values.some((value) => typeof value !== 'string') ||
            new Set(values).size !== values.length
        ) {
            fail('invalid-variant-options');
        }
        properties[name] = [...values].sort(compare);
    }
    crossProduct(properties);
    return properties;
}

// Parse only complete names composed of the exact keys and options reported by Figma.
// No icon-name, style, size or family normalization participates in this operation.
function parseVariantProperties(name, definitions) {
    const properties = enumProperties(definitions);
    const keys = Object.keys(properties);
    if (!keys.length) return {};
    if (typeof name !== 'string') fail('variant-properties-unresolved');
    const matches = new Map();
    function walk(offset, remaining, result) {
        if (matches.size > 1) return;
        for (const key of remaining) {
            for (const value of properties[key]) {
                const token = `${key}=${value}`;
                if (!name.startsWith(token, offset)) continue;
                const end = offset + token.length;
                const next = { ...result, [key]: value };
                const rest = remaining.filter((candidate) => candidate !== key);
                if (!rest.length && end === name.length) matches.set(propertyKey(next), next);
                if (rest.length && name[end] === ',') {
                    walk(end + 1, rest, next);
                    if (name[end + 1] === ' ') walk(end + 2, rest, next);
                }
            }
        }
    }
    walk(0, keys, {});
    if (matches.size !== 1) fail(matches.size ? 'variant-properties-ambiguous' : 'variant-properties-unresolved');
    const result = matches.values().next().value;
    return Object.fromEntries(keys.map((key) => [key, result[key]]));
}

function loadAssetIndex(repo) {
    const index = new Map();
    const byPack = {};
    let webRecords = 0;
    for (const pack of Object.values(PAGE_PACKS)) {
        const file = `icons-demo/src/shared/config/meta_${pack}.json`;
        const records = Object.values(JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8')));
        const packageFile = JSON.parse(fs.readFileSync(path.join(repo, `packages/${pack}/package.json`), 'utf8'));
        const packageName = `@alfalab/icons-${pack}`;
        assert.equal(packageFile.name, packageName);
        byPack[pack] = records;
        for (const record of records) {
            assert(/^[A-Za-z0-9_-]+$/.test(record.middle), 'Unsafe or invalid UI asset identifier');
            const key = `${pack}\0${record.middle}`;
            assert(!index.has(key), `Duplicate UI asset identifier: ${key}`);
            const asset = {
                ...record,
                pack,
                package: packageName,
                sourceDirectory: `packages/${pack}/src`,
                svg: `icons/${pack}/${record.middle}.svg`,
                metadataFile: file,
            };
            if (record.web) {
                assert(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(record.web));
                assert.equal(record.webComponent, `import { ${record.web} } from '${packageName}/${record.web}';`);
                webRecords++;
            }
            index.set(key, asset);
        }
    }
    return { index, byPack, webRecords };
}

function matchAssetTag(tags, index, pack) {
    if (!Array.isArray(tags) || tags.length === 0) fail('asset-tag-missing');
    if (tags.length !== 1) fail('asset-tag-ambiguous');
    const asset = index.get(`${pack}\0${tags[0]}`);
    if (!asset) fail('asset-not-in-ui-metadata');
    if (!asset.web || !asset.webComponent) fail('web-export-missing');
    return asset;
}

function svgGeometry(source) {
    const root = source.match(/<svg\b[^>]*>/)?.[0];
    if (!root) fail('svg-root-missing');
    const attribute = (name) => root.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
    const width = Number(attribute('width'));
    const height = Number(attribute('height'));
    const viewBox = (attribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (!Number.isInteger(width) || width <= 0 || width !== height) fail('unsupported-svg-geometry');
    if (viewBox.length !== 4 || viewBox.some((number) => !Number.isFinite(number))) fail('unsupported-viewbox');
    if (JSON.stringify(viewBox) !== JSON.stringify([0, 0, width, height])) fail('unsupported-viewbox');
    return { width, height, viewBox };
}

function validateAsset(repo, asset, variant, cache) {
    const key = `${asset.pack}\0${asset.middle}`;
    let geometry = cache.get(key);
    if (!geometry) {
        const svgFile = path.join(repo, asset.svg);
        const reactFile = path.join(repo, asset.sourceDirectory, `${asset.web}.tsx`);
        if (!fs.existsSync(svgFile)) fail('svg-file-missing');
        if (!fs.existsSync(reactFile)) fail('react-export-missing');
        geometry = svgGeometry(fs.readFileSync(svgFile, 'utf8'));
        const react = fs.readFileSync(reactFile, 'utf8');
        if (!new RegExp(`\\bexport\\s+const\\s+${asset.web}\\s*=`).test(react)) fail('react-export-missing');
        if (JSON.stringify(svgGeometry(react)) !== JSON.stringify(geometry)) fail('react-svg-geometry-mismatch');
        cache.set(key, geometry);
    }
    if (!Number.isFinite(variant.width) || !Number.isFinite(variant.height)) fail('figma-geometry-missing');
    if (Math.abs(variant.width - geometry.width) > 0.000001 || Math.abs(variant.height - geometry.height) > 0.000001) {
        fail('figma-svg-geometry-mismatch');
    }
    return geometry.width;
}

function hubEvidence(hub, assets) {
    if (!hub) return undefined;
    const ui = new Map(assets.byPack['glyph-26'].filter((record) => record.web).map((record) => [record.web, record]));
    const hubRows = Object.values(hub);
    const shared = [];
    const conflicts = [];
    for (const row of hubRows) {
        const current = ui.get(row.web);
        if (!current) continue;
        shared.push(row.web);
        for (const field of ['middle', 'cdn']) {
            if (row[field] !== current[field])
                conflicts.push({ web: row.web, field, hub: row[field], ui: current[field] });
        }
        if (row.package !== '@alfalab/icons-glyph-26') {
            conflicts.push({ web: row.web, field: 'package', hub: row.package, ui: '@alfalab/icons-glyph-26' });
        }
    }
    const hubNames = new Set(hubRows.map((row) => row.web));
    return {
        source: 'ds-ai-hub/core/web/assets/assets_glyph-26.json',
        records: hubRows.length,
        uiRecords: ui.size,
        sharedWebExports: shared.length,
        hubOnly: hubRows
            .filter((row) => !ui.has(row.web))
            .map((row) => row.web)
            .sort(compare),
        uiOnly: [...ui.keys()].filter((web) => !hubNames.has(web)).sort(compare),
        conflicts,
        usedForFigmaIdentity: false,
        migrationRulesApplied: false,
    };
}

function buildCatalog(capture, existingManifest, options) {
    const repo = options.repo;
    const fileKey = capture.figmaFileKey || capture.fileKey;
    assert.equal(fileKey, existingManifest.figmaFileKey, 'Capture must identify the expected Figma library');
    assert(typeof capture.retrievedAt === 'string' && !Number.isNaN(Date.parse(capture.retrievedAt)));
    if (capture.retryCompletedAt !== undefined) {
        assert(
            typeof capture.retryCompletedAt === 'string' && !Number.isNaN(Date.parse(capture.retryCompletedAt)),
            'Capture retryCompletedAt must be a valid timestamp'
        );
    }
    assert(Array.isArray(capture.pages));
    const assets = options.assets || loadAssetIndex(repo);
    const manual = existingManifest.sets.filter((set) => !set.generated).map((set) => structuredClone(set));
    const manualById = new Map(manual.map((set) => [set.figmaNodeId, set]));
    const generated = [];
    const issues = [];
    const seen = new Set();
    const geometryCache = new Map();
    const pageCoverage = [];
    const readPeriods = new Map();
    let currentRoots = 0;
    const report = (page, root, reason, extra = {}) => {
        issues.push({
            pageId: page.pageId,
            pageName: page.pageName,
            rootId: root.id,
            rootName: root.name,
            reason,
            ...extra,
        });
    };

    for (const page of capture.pages) {
        assert(Array.isArray(page.rows));
        const pack = PAGE_PACKS[page.pageName];
        const counts = {
            pageId: page.pageId,
            pageName: page.pageName,
            pack,
            expectedRoots: page.total ?? page.rows.length,
            scannedRoots: page.rows.length,
            currentRoots: 0,
            mappedRoots: 0,
            mappedVariants: 0,
        };
        pageCoverage.push(counts);
        for (const root of page.rows) {
            assert(/^\d+:\d+$/.test(root.id));
            assert(!seen.has(root.id), `Duplicate Figma root ${root.id}`);
            seen.add(root.id);
            const retrievedAt = root.retrievedAt === undefined ? capture.retrievedAt : root.retrievedAt;
            assert(
                typeof retrievedAt === 'string' && !Number.isNaN(Date.parse(retrievedAt)),
                `Invalid retrievedAt for Figma root ${root.id}`
            );
            readPeriods.set(retrievedAt, (readPeriods.get(retrievedAt) || 0) + 1);
            if (!pack) {
                report(page, root, 'unknown-source-page');
                continue;
            }
            if (root.publish !== 'CURRENT') {
                report(page, root, root.publish === 'CHANGED' ? 'unpublished-local-changes' : 'not-published');
                continue;
            }
            currentRoots++;
            counts.currentRoots++;
            let properties;
            let parsed;
            try {
                if (!['COMPONENT_SET', 'COMPONENT'].includes(root.type)) fail('unsupported-root-type');
                if (!root.key) fail('component-key-missing');
                properties = enumProperties(root.definitions);
                if (!Array.isArray(root.variants) || !root.variants.length) fail('variants-missing');
                parsed = root.variants.map((variant) => ({
                    variant,
                    properties: parseVariantProperties(variant.name, root.definitions),
                }));
                if (new Set(parsed.map((row) => propertyKey(row.properties))).size !== parsed.length)
                    fail('duplicate-variant-state');
            } catch (error) {
                if (!(error instanceof CatalogError)) throw error;
                report(page, root, error.code);
                continue;
            }
            const supported = [];
            const unsupportedByState = new Map();
            for (const row of parsed) {
                try {
                    if (!/^\d+:\d+$/.test(row.variant.id) || !row.variant.key) fail('variant-identity-missing');
                    const asset = matchAssetTag(row.variant.assetTags, assets.index, pack);
                    const size = validateAsset(repo, asset, row.variant, geometryCache);
                    supported.push({
                        properties: row.properties,
                        export: asset.web,
                        svg: asset.svg,
                        size,
                        figmaNodeId: row.variant.id,
                        componentKey: row.variant.key,
                        sourceAssetTag: asset.middle,
                    });
                } catch (error) {
                    if (!(error instanceof CatalogError)) throw error;
                    unsupportedByState.set(propertyKey(row.properties), {
                        properties: row.properties,
                        reasonCode: error.code,
                        reason: `Точное соответствие не подтверждено: ${error.code}`,
                    });
                    report(page, root, error.code, {
                        variantId: row.variant.id,
                        properties: row.properties,
                        assetTags: row.variant.assetTags,
                    });
                }
            }
            const provenance = {
                componentKey: root.key,
                pageId: page.pageId,
                pageName: page.pageName,
                publishStatus: root.publish,
                retrievedAt,
                propertyDefinitions: root.definitions,
            };
            const previous = manualById.get(root.id);
            if (previous) {
                const byState = new Map(supported.map((variant) => [propertyKey(variant.properties), variant]));
                let complete = true;
                for (const variant of previous.variants) {
                    const fresh = byState.get(propertyKey(variant.properties));
                    if (
                        !fresh ||
                        variant.export !== fresh.export ||
                        variant.svg !== fresh.svg ||
                        variant.size !== fresh.size
                    ) {
                        complete = false;
                        continue;
                    }
                    Object.assign(variant, {
                        figmaNodeId: fresh.figmaNodeId,
                        componentKey: fresh.componentKey,
                        sourceAssetTag: fresh.sourceAssetTag,
                    });
                }
                if (complete) previous.provenance = provenance;
                else report(page, root, 'manual-template-source-needs-review');
                counts.mappedRoots++;
                counts.mappedVariants += previous.variants.length;
                continue;
            }
            if (!supported.length) {
                report(page, root, 'no-supported-variant');
                continue;
            }
            const supportedKeys = new Set(supported.map((variant) => propertyKey(variant.properties)));
            const unsupported = crossProduct(properties)
                .filter((state) => !supportedKeys.has(propertyKey(state)))
                .map(
                    (state) =>
                        unsupportedByState.get(propertyKey(state)) || {
                            properties: state,
                            reasonCode: 'no-figma-variant',
                            reason: 'В прочитанном опубликованном наборе нет такого варианта',
                        }
                );
            supported.sort((left, right) => compare(propertyKey(left.properties), propertyKey(right.properties)));
            const id = root.id.replace(':', '-');
            generated.push({
                name: root.name,
                template: `code-connect/icons/generated/${pack}/${id}.figma.ts`,
                id: `ui-primitives-icon-${pack}-${id}`,
                figmaNodeId: root.id,
                package: `@alfalab/icons-${pack}`,
                sourceDirectory: `packages/${pack}/src`,
                properties,
                variants: supported,
                unsupported,
                generated: true,
                provenance,
            });
            counts.mappedRoots++;
            counts.mappedVariants += supported.length;
        }
    }
    const unread = [];
    if (options.inventory) {
        assert(Array.isArray(options.inventory));
        const inventoryIds = new Set();
        for (const page of options.inventory) {
            assert.equal(page.rows.length, page.total, 'The broad inventory must be complete');
            for (const root of page.rows) {
                assert(!inventoryIds.has(root.id), 'Duplicate inventory root');
                inventoryIds.add(root.id);
                if (!seen.has(root.id)) {
                    unread.push({ pageId: page.pageId, pageName: page.pageName, rootId: root.id, rootName: root.name });
                    report(page, root, 'figma-source-not-read');
                }
            }
        }
        for (const id of seen) assert(inventoryIds.has(id), 'Capture contains a root outside the inventory');
        const failedIds = new Set((capture.errors || []).flatMap((error) => error.job?.ids || []));
        assert.deepEqual(
            [...failedIds].sort(compare),
            unread.map((root) => root.rootId).sort(compare),
            'Unread roots must reconcile with the failed source batches'
        );
    } else if (capture.pages.some((page) => (page.total ?? page.rows.length) !== page.rows.length)) {
        fail('partial-capture-requires-inventory');
    }
    for (const page of pageCoverage) page.unreadRoots = page.expectedRoots - page.scannedRoots;
    generated.sort((left, right) => compare(left.template, right.template));
    const sets = [...manual, ...generated];
    const uniqueAssets = new Set(
        sets.flatMap((set) => set.variants.map((variant) => `${set.package}\0${variant.export}`))
    );
    const reasonCounts = {};
    for (const issue of issues) reasonCounts[issue.reason] = (reasonCounts[issue.reason] || 0) + 1;
    return {
        schemaVersion: 1,
        figmaFileKey: fileKey,
        sets,
        sources: {
            retrievedAt: capture.retrievedAt,
            ...(capture.retryCompletedAt === undefined ? {} : { retryCompletedAt: capture.retryCompletedAt }),
            readPeriods: [...readPeriods]
                .sort(([left], [right]) => Date.parse(left) - Date.parse(right) || compare(left, right))
                .map(([retrievedAt, roots]) => ({ retrievedAt, roots })),
            captureSha256: crypto.createHash('sha256').update(JSON.stringify(capture)).digest('hex'),
            partial: unread.length > 0,
            figma: 'Figma Plugin API: exact component identities, definitions and raw description asset tags',
            uiMetadata: Object.keys(assets.byPack).map((pack) => `icons-demo/src/shared/config/meta_${pack}.json`),
            hub: hubEvidence(options.hubCatalog, assets),
        },
        coverage: {
            expectedRoots: seen.size + unread.length,
            scannedRoots: seen.size,
            unreadRoots: unread.length,
            sourceReadErrors: (capture.errors || []).length,
            currentRoots,
            manualRootsRetained: manual.length,
            generatedRoots: generated.length,
            mappedRoots: sets.length,
            mappedVariants: sets.reduce((sum, set) => sum + set.variants.length, 0),
            uniqueReactExports: uniqueAssets.size,
            uiWebMetadataRecords: assets.webRecords,
            pages: pageCoverage,
            reasonCounts,
            issues,
            excludedCatalogs: ['classic', 'shape', 'art', 'dev'],
            scope: 'Confirmed published Figma roots with exact UI web metadata matches; not the complete SVG catalog',
        },
    };
}

async function main() {
    const args = process.argv.slice(2);
    const options = {};
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--write') options.write = true;
        else if (['--capture', '--hub-catalog', '--inventory'].includes(args[index]))
            options[args[index].slice(2)] = args[++index];
        else throw new Error(`Unknown argument: ${args[index]}`);
    }
    assert(
        options.capture,
        'Usage: node scripts/code-connect/catalog.cjs --capture <file> [--inventory <file>] [--hub-catalog <file>] [--write]'
    );
    const repo = path.resolve(__dirname, '../..');
    const manifestFile = path.join(repo, 'code-connect/icons/manifest.json');
    const capture = JSON.parse(fs.readFileSync(options.capture, 'utf8'));
    const current = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const next = buildCatalog(capture, current, {
        repo,
        hubCatalog: options['hub-catalog'] ? JSON.parse(fs.readFileSync(options['hub-catalog'], 'utf8')) : undefined,
        inventory: options.inventory ? JSON.parse(fs.readFileSync(options.inventory, 'utf8')) : undefined,
    });
    if (options.write) {
        const prettier = require('prettier');
        const configuration = await prettier.resolveConfig(manifestFile);
        fs.writeFileSync(
            manifestFile,
            await prettier.format(JSON.stringify(next), { ...configuration, filepath: manifestFile })
        );
    }
    console.log(
        JSON.stringify({
            written: Boolean(options.write),
            ...next.coverage,
            issues: next.coverage.issues.length,
            hub: next.sources.hub,
        })
    );
}

module.exports = {
    CatalogError,
    propertyKey,
    crossProduct,
    parseVariantProperties,
    loadAssetIndex,
    matchAssetTag,
    buildCatalog,
    svgGeometry,
};
if (require.main === module)
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
