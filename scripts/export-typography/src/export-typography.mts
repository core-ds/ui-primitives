import { toPlatformPath } from '@actions/core';
import fsExtra from 'fs-extra/esm';
import { Platform, Handler, Deprecatable, Entry } from './types.mjs';
import { sortEntries } from './utils.mjs';
import path from 'node:path';

export async function exportTypography() {
    for (const platform of [Platform.WEB, Platform.ANDROID, Platform.IOS]) {
        const { default: handler } = (await import(`./export-typography-${platform.toLowerCase()}.mjs`)) as {
            default: Handler;
        };
        const fileKeys: string[] = JSON.parse(process.env[`${platform}_TYPOGRAPHY_FILE_KEYS`]);

        for (const { file, entries } of await handler(fileKeys)) {
            const platformPath = path.resolve(process.cwd(), toPlatformPath(file));
            const sortedEntries = sortEntries(entries);
            const deprecated: Entry<Deprecatable>[] = [];

            try {
                const oldJson: Record<string, Deprecatable> = await fsExtra.readJson(platformPath, {
                    encoding: 'utf8',
                });

                deprecated.push(
                    ...sortEntries(
                        Object.entries(oldJson)
                            .filter(([name]) => sortedEntries.every((entry) => !entry.includes(name)))
                            .map(([name, value]) => [name, { ...value, deprecated: true }])
                    )
                );
            } catch {}

            const json = Object.fromEntries(sortedEntries.concat(deprecated));

            await fsExtra.writeJson(platformPath, json, { encoding: 'utf8', spaces: 4 });
        }
    }
}
