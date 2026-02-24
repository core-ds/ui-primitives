export enum FontFamily {
    ALFASANS = "Alfa Interface Sans",
    STYRENE = "Styrene UI",
}

export enum Platform {
    WEB = "WEB",
    IOS = "IOS",
    ANDROID = "ANDROID",
}

export interface Deprecatable {
    deprecated?: boolean | undefined;
}

export interface WebTypographyParams extends Deprecatable {
    font_size?: number | undefined;
    line_height?: number | undefined;
    font_weight?: number | undefined;
    font_family?: string | undefined;
    letter_spacing?: number | undefined;
    text_transform?: string | undefined;
}

export interface AndroidTypographyParams extends Deprecatable {
    font_size?: number | undefined;
    line_height?: number | undefined;
    line_spacing?: number | undefined;
    line_spacing_extra?: number | undefined;
    font_family?: string | undefined;
    text_all_caps: boolean;
    letter_spacing?: number | undefined;
    letter_spacing_sp?: number | undefined;
    first_baseline_to_top_height?: number | undefined;
    last_baseline_to_bottom_height?: number | undefined;
}

export interface IOSTypographyParams extends Deprecatable {
    font_size?: number | undefined;
    line_height?: number | undefined;
    line_spacing?: number | undefined;
    font_family?: string | undefined;
    font_weight?: string | undefined;
    text_all_caps: boolean;
    letter_spacing?: number | undefined;
    monospace: boolean;
}

export type Entry<T> = [name: string, T];

export type Handler = (fileKeys: string[]) => Promise<{ file: string; entries: Entry<Deprecatable>[] }[]>;
