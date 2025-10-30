import { pascalCase } from "change-case";
import { FontFamily, IOSTypographyParams, Handler, Entry } from "./types.mjs";
import { fetchFile, handleLetterSpacing, walkNodes } from "./utils.js";

type TypographyEntry = Entry<IOSTypographyParams>;

const handler: Handler = async (fileKeys: string[]) => {
    const alfasansTypography: TypographyEntry[] = [];
    const systemTypography: TypographyEntry[] = [];

    for (const fileKey of fileKeys) {
        const file = await fetchFile(fileKey);

        walkNodes([file.document], (node) => {
            if (node.type === "SECTION" && node.name.startsWith("TextStylesExport")) {
                const target = node.name.endsWith("AlfaSans") ? alfasansTypography : systemTypography;

                target.push(
                    ...node.children
                        .filter((childNode) => childNode.type === "TEXT")
                        .map<TypographyEntry>(({ characters, style }) => {
                            const name = pascalCase(characters);
                            const monospace = characters.toLowerCase().includes("mono");
                            const textAllCaps = style.textCase === "UPPER";
                            const { fontSize, lineHeightPx: lineHeight, fontStyle } = style;
                            const fontFamily = style.fontFamily === FontFamily.ALFASANS ? style.fontFamily : "System";
                            const fontWeight = fontStyle?.toLowerCase();
                            const letterSpacing = handleLetterSpacing(style.letterSpacing);
                            let lineSpacing: number | undefined;

                            if (typeof fontSize === "number" && typeof lineHeight === "number") {
                                /**
                                 * Magic number
                                 */
                                const NATURAL_LINE_HEIGHT = 1.2;
                                lineSpacing = Math.round(lineHeight - fontSize * NATURAL_LINE_HEIGHT);
                            }

                            return [
                                name,
                                {
                                    font_size: fontSize,
                                    line_height: lineHeight,
                                    line_spacing: lineSpacing,
                                    font_family: fontFamily,
                                    font_weight: fontWeight,
                                    text_all_caps: textAllCaps,
                                    letter_spacing: letterSpacing,
                                    monospace,
                                },
                            ];
                        })
                );
            }
        });
    }

    return [
        {
            file: "styles/typography_ios.json",
            entries: systemTypography,
        },
        {
            file: "styles/typography_alfasans_ios.json",
            entries: alfasansTypography,
        },
    ];
};

export default handler;
