import { AndroidTypographyParams, FontHandler } from "./types.mjs";
import { pascalCase, snakeCase } from "change-case";
import { findNode } from "./utils.js";
import { SectionNode, TextNode } from "@figma/rest-api-spec";

const androidFontHandler: FontHandler<AndroidTypographyParams> = {
    mapToParams({ characters, style }, documentNode) {
        const name = pascalCase(characters);
        const textAllCaps = style.textCase === "UPPER";
        const { fontFamily, fontSize, lineHeightPx: lineHeight } = style;
        let { letterSpacing } = style;
        let lineSpacing: number | undefined;
        let lineSpacingExtra: number | undefined;
        let firstBaselineToTopHeight: number | undefined;
        let lastBaselineToBottomHeight: number | undefined;
        /**
         * Magic number
         */
        const NATURAL_LINE_HEIGHT = 1.17;

        if (letterSpacing) {
            letterSpacing = parseFloat(letterSpacing.toFixed(2));
        }

        if (typeof fontSize === "number" && typeof lineHeight === "number") {
            lineSpacing = Math.floor(lineHeight - fontSize * NATURAL_LINE_HEIGHT);
            lineSpacingExtra = Math.round(lineHeight - fontSize * NATURAL_LINE_HEIGHT);

            const baselineNode = findNode(
                [documentNode],
                (node): node is SectionNode => node.type === "SECTION" && node.name === "BaselineExport"
            );

            if (baselineNode) {
                const node = baselineNode.children.find(
                    (child): child is TextNode =>
                        child.type === "TEXT" && child.characters.startsWith(`${fontSize}-${lineHeight}`)
                );

                if (node) {
                    [, , firstBaselineToTopHeight, lastBaselineToBottomHeight] = node.characters
                        .split("-")
                        .map((val) => parseInt(val, 10));
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
    },
    mapFontFamily(fontFamily) {
        return typeof fontFamily === "string" ? snakeCase(fontFamily) : fontFamily;
    },
};

export default androidFontHandler;
