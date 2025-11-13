import { Entry, FontFamily, Handler, WebTypographyParams } from "./types.mjs";
import { fetchFile, handleLetterSpacing, forEachNode } from "./utils.js";

function mapFontFamily(fontFamily: string | undefined) {
    switch (fontFamily) {
        case FontFamily.ALFASANS:
            return "var(--font-family-alfasans)";
        case FontFamily.STYRENE:
            return "var(--font-family-styrene)";
        default:
            return "var(--font-family-system)";
    }
}

type TypographyEntry = Entry<WebTypographyParams>;

const handler: Handler = async (fileKeys: string[]) => {
    const alfasansTypography: TypographyEntry[] = [];
    const systemTypography: TypographyEntry[] = [];

    for (const fileKey of fileKeys) {
        const file = await fetchFile(fileKey);

        forEachNode([file.document], (node) => {
            if (node.type === "SECTION" && node.name.startsWith("TextStylesExport")) {
                const target = node.name.endsWith("AlfaSans") ? alfasansTypography : systemTypography;

                target.push(
                    ...node.children
                        .filter((childNode) => childNode.type === "TEXT")
                        .map<TypographyEntry>(({ characters, style }) => {
                            const name = characters.toLowerCase();
                            const textTransform = style.textCase === "UPPER" ? "uppercase" : undefined;
                            const { fontSize, lineHeightPx: lineHeight } = style;
                            const fontFamily = mapFontFamily(style.fontFamily);
                            let letterSpacing: number | undefined;

                            if (
                                style.fontFamily === FontFamily.ALFASANS ||
                                name.includes("caps") ||
                                name.includes("tagline")
                            ) {
                                letterSpacing = handleLetterSpacing(style.letterSpacing);
                            }

                            return [
                                name,
                                {
                                    font_size: fontSize,
                                    line_height: lineHeight,
                                    font_weight: style.fontWeight,
                                    letter_spacing: letterSpacing,
                                    text_transform: textTransform,
                                    font_family: fontFamily,
                                },
                            ];
                        })
                );
            }
        });
    }

    return [
        {
            file: "styles/typography_web.json",
            entries: systemTypography,
        },
        {
            file: "styles/typography_web_alfasans.json",
            entries: alfasansTypography,
        },
    ];
};

export default handler;
