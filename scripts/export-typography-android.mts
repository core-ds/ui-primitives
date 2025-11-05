import { AndroidTypographyParams, Entry, Handler } from "./types.mjs";
import { pascalCase, snakeCase } from "change-case";
import { fetchFile, findNode, handleLetterSpacing, forEachNode } from "./utils.js";
import { SectionNode, TextNode } from "@figma/rest-api-spec";

type TypographyEntry = Entry<AndroidTypographyParams>;

const handler: Handler = async (fileKeys: string[]) => {
    const alfasansTypography: TypographyEntry[] = [];
    const alfasansFixedTypography: TypographyEntry[] = [];
    const systemTypography: TypographyEntry[] = [];
    const systemFixedTypography: TypographyEntry[] = [];

    for (const fileKey of fileKeys) {
        const file = await fetchFile(fileKey);

        const baselineNode = findNode(
            [file.document],
            (node): node is SectionNode => node.type === "SECTION" && node.name === "BaselineExport"
        );

        forEachNode([file.document], (node) => {
            if (node.type === "SECTION" && node.name.startsWith("TextStylesExport")) {
                const target = node.name.endsWith("AlfaSans")
                    ? alfasansTypography
                    : node.name.endsWith("AlfaSansFixed")
                    ? alfasansFixedTypography
                    : node.name.endsWith("Fixed")
                    ? systemFixedTypography
                    : systemTypography;

                target.push(
                    ...node.children
                        .filter((childNode) => childNode.type === "TEXT")
                        .map<TypographyEntry>(({ characters, style }) => {
                            const name = pascalCase(characters);
                            const textAllCaps = style.textCase === "UPPER";
                            const { fontSize, fontStyle, lineHeightPx: lineHeight } = style;
                            const fontFamily =
                                typeof style.fontFamily === "string"
                                    ? `${snakeCase(style.fontFamily)}${fontStyle ? `_${fontStyle.toLowerCase()}` : ""}`
                                    : style.fontFamily;
                            let letterSpacing: number | undefined;
                            let lineSpacing: number | undefined;
                            let lineSpacingExtra: number | undefined;
                            let firstBaselineToTopHeight: number | undefined;
                            let lastBaselineToBottomHeight: number | undefined;

                            if (typeof fontSize === "number") {
                                if (typeof style.letterSpacing === "number") {
                                    letterSpacing = handleLetterSpacing(style.letterSpacing / fontSize);
                                }

                                if (typeof lineHeight === "number") {
                                    /**
                                     * Magic number
                                     */
                                    const NATURAL_LINE_HEIGHT = 1.17;
                                    lineSpacing = Math.floor(lineHeight - fontSize * NATURAL_LINE_HEIGHT);
                                    lineSpacingExtra = Math.round(lineHeight - fontSize * NATURAL_LINE_HEIGHT);

                                    if (baselineNode) {
                                        const node = baselineNode.children.find(
                                            (child): child is TextNode =>
                                                child.type === "TEXT" &&
                                                child.characters.startsWith(`${fontSize}-${lineHeight}`)
                                        );

                                        if (node) {
                                            [, , firstBaselineToTopHeight, lastBaselineToBottomHeight] = node.characters
                                                .split("-")
                                                .map((val) => parseInt(val, 10));
                                        }
                                    }
                                }
                            }

                            return [
                                name,
                                {
                                    font_size: fontSize,
                                    line_height: lineHeight,
                                    line_spacing: lineSpacing,
                                    line_spacing_extra: lineSpacingExtra,
                                    font_family: fontFamily,
                                    text_all_caps: textAllCaps,
                                    letter_spacing: letterSpacing,
                                    first_baseline_to_top_height: firstBaselineToTopHeight,
                                    last_baseline_to_bottom_height: lastBaselineToBottomHeight,
                                },
                            ];
                        })
                );
            }
        });
    }

    return [
        {
            file: "styles/typography_alfasans_android.json",
            entries: alfasansTypography,
        },
        {
            file: "styles/typography_alfasans_fixed_android.json",
            entries: alfasansFixedTypography,
        },
        {
            file: "styles/typography_android.json",
            entries: systemTypography,
        },
        {
            file: "styles/typography_fixed_android.json",
            entries: systemFixedTypography,
        },
    ];
};

export default handler;
