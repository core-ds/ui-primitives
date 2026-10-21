import fs from 'node:fs/promises';
import path from 'node:path';
import camelCase from 'camelcase';
import Svgo from 'svgo';
import styleToObject from 'style-to-js';

export const iconTemplate = `
/**
 * This is auto-generated file by scripts/svg-to-component package
 * Do not edit it manually
 */
import React, { SVGProps } from 'react';

export const {{ComponentName}}: React.FC<SVGProps<SVGSVGElement>> = props => (
    {{body}}
);

export default {{ComponentName}};
`.trimStart();

const removeEmptyRect = (item: any) => {
    const isRect = item.elem === 'rect';
    const noFill = item.attrs && item.attrs.fill ? item.attrs.fill.value === 'none' : true;
    const noChilds = item.content ? item.content.length === 0 : true;

    if (isRect && noChilds && noFill) {
        item.attrs = {};
    }

    return item;
};

const renameAttributesToCamelCase = (item: any) => {
    Object.keys(item.attrs || {}).forEach((rawAttributeName) => {
        if (rawAttributeName.includes('-') && !rawAttributeName.includes('data-')) {
            const attribute = item.attrs[rawAttributeName];

            delete item.attrs[rawAttributeName];

            const attributeName = camelCase(rawAttributeName);

            item.attrs[attributeName] = {
                ...attribute,
                name: attributeName,
                local: camelCase(attribute.local),
            };
        }
    });

    return item;
};

const optimizer = new Svgo({
    plugins: [
        { convertPathData: { noSpaceAfterFlags: false } },
        { mergePaths: { noSpaceAfterFlags: false } },
        { removeAttrs: { attrs: '(xmlns|class)' } },
        { removeXMLNS: true },
        { prefixIds: true },
        { removeViewBox: false },
        { convertShapeToPath: false },
        {
            // @ts-expect-error
            removeEmptyRect: {
                type: 'perItem',
                description: 'Remove empty rect',
                fn: removeEmptyRect,
            },
        },
    ],
});

const monoColorOptimizer = new Svgo({
    plugins: [{ removeAttrs: { attrs: 'fill' } }, { removeViewBox: false }],
});

const renameAttributesOptimizer = new Svgo({
    plugins: [
        { removeViewBox: false },
        {
            // @ts-expect-error
            renameAttributesToCamelCase: {
                type: 'perItem',
                description: 'rename attributes to camel-case',
                fn: renameAttributesToCamelCase,
            },
        },
    ],
});

const transformSvg = (svg: string): string =>
    svg
        .replace(/xmlns:xlink/g, 'xmlnsXlink')
        .replace(/xlink:href/g, 'xlinkHref')
        .replace(/<rect\/>/g, '')
        .replace(/style="(.+?)"/g, (_, m) => `style={${JSON.stringify(styleToObject(m))}}`);

export function generateComponentName(file: string) {
    const basename = path.parse(file).name;
    const dirname = path.basename(path.dirname(file));
    const iconParams = basename.split('_');
    const [name, size, color] = ['android', 'ios'].includes(dirname) ? iconParams : iconParams.slice(1);
    const componentName = camelCase([name, size, color, 'icon'].filter(Boolean).join('_'), { pascalCase: true });

    return { componentName, color };
}

export async function createComponent(src: string, out: string): Promise<void> {
    const content = await fs.readFile(src, { encoding: 'utf8' });
    const { componentName, color } = generateComponentName(src);
    let { data } = await optimizer.optimize(content);

    if (!color) {
        ({ data } = await monoColorOptimizer.optimize(data));
    }

    ({ data } = await renameAttributesOptimizer.optimize(data));

    data = transformSvg(data);

    const code = iconTemplate
        .replace(/{{ComponentName}}/g, `${componentName}`)
        .replace('{{body}}', data)
        .replace(/viewBox=\"[^"]*"/g, '$& {...props}')
        .replace('<svg', `<svg role="img" focusable="false" ${color ? '' : 'fill="currentColor"'}`);

    const dest = path.join(out, `${componentName}.tsx`);

    await fs.writeFile(dest, code, { encoding: 'utf8' });
}
