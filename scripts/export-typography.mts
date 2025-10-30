import { GetFileResponse, Node, SectionNode } from "@figma/rest-api-spec";
import { toPlatformPath } from "@actions/core";
import fse from "fs-extra";
import { FontFamily, FontHandler, Platform, TypographyDescription, TypographyParams } from "./types.mjs";

function findFrame(nodes: Node[], name: string): SectionNode | undefined {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;

        if (node.type === "SECTION" && node.name === name) {
            return node;
        }

        if ("children" in node) {
            const child = findFrame(node.children, name);

            if (child) {
                return child;
            }
        }
    }
}

export async function exportTypography() {
    const { FIGMA_TOKEN } = process.env;

    for (const platform of [Platform.WEB]) {
        const { default: handler } = (await import(`./export-typography-${platform.toLowerCase()}.mjs`)) as {
            default: FontHandler;
        };

        const fileKeys = JSON.parse(process.env[`${platform}_TYPOGRAPHY_FILE_KEYS`]);
        const results: TypographyDescription[] = [];
        for (const fileKey of fileKeys) {
            const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                headers: { "X-FIGMA-TOKEN": FIGMA_TOKEN },
            });
            const file: GetFileResponse = await response.json();
            const typographyFrame = findFrame([file.document], "TextStylesExport");

            if (typographyFrame) {
                results.push(
                    ...typographyFrame.children
                        .filter((node) => node.type === "TEXT")
                        .map((node) => handler.mapToParams(node, file.document))
                );
            }
        }

        results.sort(([aName], [bName]) => aName.localeCompare(bName));

        for (const { file, entries } of [
            {
                file: toPlatformPath(`styles/typography_${platform.toLowerCase()}.json`),
                entries: results.filter(([, { font_family }]) => !(font_family === FontFamily.ALFASANS)),
            },
            {
                file: toPlatformPath(`styles/typography_alfasans_${platform.toLowerCase()}.json`),
                entries: results.filter(([, { font_family }]) => font_family === FontFamily.ALFASANS),
            },
        ]) {
            const deprecated: TypographyDescription[] = [];

            try {
                const oldJson: Record<string, TypographyParams> = await fse.readJson(file, { encoding: "utf8" });

                deprecated.push(
                    ...Object.entries(oldJson)
                        .filter(([name]) => entries.every((entry) => !entry.includes(name)))
                        .map<TypographyDescription>(([name, value]) => [name, { ...value, deprecated: true }])
                        .sort(([aName], [bName]) => aName.localeCompare(bName))
                );
            } catch {}

            const json = Object.fromEntries(
                entries
                    .map<TypographyDescription>(([name, value]) => [
                        name,
                        { ...value, font_family: handler.mapFontFamily(value.font_family) },
                    ])
                    .concat(deprecated)
            );

            await fse.writeJson(file, json, { encoding: "utf8", spaces: 4 });
        }
    }
}
