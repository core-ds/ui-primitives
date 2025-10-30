import { pascalCase } from "change-case";
import { FontFamily, FontHandler, IOSTypographyParams } from "./types.mjs";

const iosFontHandler: FontHandler<IOSTypographyParams> = {
    mapToParams({ characters, style }) {
        const name = pascalCase(characters);
        const monospace = characters.toLowerCase().includes("mono");
        const textAllCaps = style.textCase === "UPPER";
        const { fontFamily, fontSize, lineHeightPx: lineHeight, fontStyle } = style;
        const fontWeight = fontStyle?.toLowerCase();
        let { letterSpacing } = style;
        let lineSpacing: number | undefined;

        if (letterSpacing) {
            letterSpacing = parseFloat(letterSpacing.toFixed(2));
        }

        if (typeof fontSize === "number" && typeof lineHeight === "number") {
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
    },
    mapFontFamily(fontFamily) {
        switch (fontFamily) {
            case FontFamily.ALFASANS:
                return fontFamily;
            default:
                return "System";
        }
    },
};

export default iosFontHandler;
