import { GetFileResponse, Node, SectionNode } from "@figma/rest-api-spec";
import { toPlatformPath } from "@actions/core";
import fse from "fs-extra";

interface TypographyParams {
    font_size?: number | undefined;
    line_height?: number | undefined;
    font_weight?: number | undefined;
    font_family?: string | undefined;
    letter_spacing?: number | undefined;
    text_transform?: string | undefined;
    deprecated?: boolean | undefined;
}

type TypographyDescription = readonly [name: string, value: TypographyParams];

enum FontFamily {
    ALFASANS = "Alfa Interface Sans",
    STYRENE = "Styrene UI",
}

enum Platform {
    WEB = "WEB",
    IOS = "IOS",
    ANDROID = "ANDROID",
}

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

function mapFontFamily(fontFamily: string | undefined): string | undefined {
    switch (fontFamily) {
        case FontFamily.ALFASANS:
            return "var(--font-family-alfasans)";
        case FontFamily.STYRENE:
            return "var(--font-family-styrene)";
        default:
            return "var(--font-family-system)";
    }
}

export async function exportTypography() {
    const { FIGMA_TOKEN } = process.env;

    for (const platform of [Platform.WEB]) {
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
                        .map<TypographyDescription>(({ characters, style }) => {
                            const name = characters.toLowerCase();
                            const textTransform = style.textCase === "UPPER" ? "uppercase" : undefined;
                            const { fontFamily } = style;
                            let { letterSpacing } = style;

                            if (
                                letterSpacing &&
                                (fontFamily === FontFamily.ALFASANS ||
                                    name.includes("caps") ||
                                    name.includes("tagline"))
                            ) {
                                letterSpacing = parseFloat(letterSpacing.toFixed(2));
                            } else {
                                letterSpacing = undefined;
                            }

                            return [
                                name,
                                {
                                    font_size: style.fontSize,
                                    line_height: style.lineHeightPx,
                                    font_weight: style.fontWeight,
                                    letter_spacing: letterSpacing,
                                    text_transform: textTransform,
                                    font_family: fontFamily,
                                },
                            ];
                        })
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
                );
            } catch {}

            const json = Object.fromEntries(
                entries
                    .map<TypographyDescription>(([name, value]) => [
                        name,
                        { ...value, font_family: mapFontFamily(value.font_family) },
                    ])
                    .concat(deprecated.sort(([aName], [bName]) => aName.localeCompare(bName)))
            );

            await fse.writeJson(file, json, { encoding: "utf8", spaces: 4 });
        }
    }
}
