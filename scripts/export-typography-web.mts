import { FontFamily, FontHandler, WebTypographyParams } from "./types.mjs";

const webFontHandler: FontHandler<WebTypographyParams> = {
    mapToParams({ characters, style }) {
        const name = characters.toLowerCase();
        const textTransform = style.textCase === "UPPER" ? "uppercase" : undefined;
        const { fontFamily, fontSize, lineHeightPx: lineHeight } = style;
        let { letterSpacing } = style;

        if (
            letterSpacing &&
            (fontFamily === FontFamily.ALFASANS || name.includes("caps") || name.includes("tagline"))
        ) {
            letterSpacing = parseFloat(letterSpacing.toFixed(2));
        } else {
            letterSpacing = undefined;
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
    },
    mapFontFamily(fontFamily) {
        switch (fontFamily) {
            case FontFamily.ALFASANS:
                return "var(--font-family-alfasans)";
            case FontFamily.STYRENE:
                return "var(--font-family-styrene)";
            default:
                return "var(--font-family-system)";
        }
    },
};

export default webFontHandler;
