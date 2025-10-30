import { DocumentNode, TextNode } from "@figma/rest-api-spec";

export enum FontFamily {
    ALFASANS = "Alfa Interface Sans",
    STYRENE = "Styrene UI",
}

export enum Platform {
    WEB = "WEB",
    IOS = "IOS",
    ANDROID = "ANDROID",
}

export interface TypographyWebParams {
    font_size?: number | undefined;
    line_height?: number | undefined;
    font_weight?: number | undefined;
    font_family?: string | undefined;
    letter_spacing?: number | undefined;
    text_transform?: string | undefined;
    deprecated?: boolean | undefined;
}

export type TypographyParams = TypographyWebParams;

export type TypographyDescription<T extends TypographyParams = TypographyParams> = readonly [name: string, value: T];

export interface FontHandler<T extends TypographyParams = TypographyParams> {
    mapToParams(node: TextNode, document: DocumentNode): TypographyDescription<T>;
    mapFontFamily(fontFamily: string | undefined): string | undefined;
}
