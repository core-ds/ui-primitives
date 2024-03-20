/// <reference types="vite/client" />

type Platform = "web" | "ios" | "android";

type TypographyMeta = {
    font_size: number;
    line_height: number;
    line_spacing: number;
    font_family: string;
    font_weight: string | number;
    text_all_caps: boolean;
    letter_spacing: number;
    text_transform: string;
    monospace: boolean;
};

type ColorToken = {
    type: "color";
    name: string;
};

type TypographyToken = {
    type: "typography";
    name: string;
    nameComponentTypography: string;
    nameComponentText: string;
    nameMixin: string;
    meta: TypographyMeta;
};

type Token = ColorToken | TypographyToken;
