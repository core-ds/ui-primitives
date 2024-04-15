import { colors, typography } from "./vars";

console.log({ colors, typography });

const EN_DASH = "\u2013";
const typographyRegex = /\w+\s?\/\s?\d+-\d+/;
const TEXT_COMPONENT = "Text";
const TITLE_COMPONENT = "Title";
const TITLE_MOBILE_COMPONENT = "TitleMobile";

export function convert(styleName: string, platform: Platform): Token | undefined {
    styleName = styleName.replace(new RegExp(EN_DASH, "g"), "-");

    if (typographyRegex.test(styleName)) {
        return convertTypographyToken(styleName, platform);
    } else {
        return convertColorToken(styleName, platform);
    }
}

function convertColorToken(styleName: string, platform: Platform) {
    styleName = styleName.trim().replace(/\s\(.*\)$/, "");

    const token = findTokenByFigmaAlias(styleName) ?? findTokenInColorKeys(styleName);

    if (!token) return;

    return {
        type: "color",
        name: platform === "web" ? `var(${token.web ?? "отсутствует web алиас"})` : token.alias,
    } as const;
}

function findTokenByFigmaAlias(styleName: string) {
    for (const key in colors) {
        const token = colors[key];
        if (token.figma === styleName && key.includes("dark") === false) {
            return token;
        }
    }

    return null;
}

function findTokenInColorKeys(styleName: string) {
    let key = toSnakeCase(styleName.replace(/\//g, "_"));

    if (/(light|dark|static)_/.test(key) === false) {
        key = `light_${key}`;
    }

    const suffixes: string[] = [];

    ["transparent", "inverted"].forEach((suffix) => {
        if (key.includes(`_${suffix}`)) {
            suffixes.push(suffix);
            key = key.replace(`_${suffix}`, "");
        }
    });

    suffixes.forEach((suffix) => {
        key = `${key}_${suffix}`;
    });

    return colors[key];
}

function convertTypographyToken(originalStyleName: string, platform: Platform) {
    let styleName = originalStyleName;

    if (platform === "web" && originalStyleName.startsWith("Mono")) {
        // TODO: в веб токенах нет информации о моноширинности
        styleName = originalStyleName.replace("Mono", "Paragraph");
    }

    const { groupName, size, fontSize, lineHeight } = parseTypographyStyle(styleName);

    let tokenName;
    if (platform === "web") {
        tokenName = `${toDashCase(groupName)}_${toSnakeCase(size)}`;
    } else {
        tokenName = `${toPascalCase(groupName)}${toPascalCase(size)}`;
    }

    const typographySet = typography[platform];

    if (tokenName in typographySet) {
        const token = typographySet[tokenName as keyof typeof typographySet] as TypographyMeta;

        if (platform === "web" && originalStyleName.startsWith("Mono")) {
            // TODO: в веб токенах нет информации о моноширинности
            token.monospace = true;
        }

        if (token.font_size !== fontSize || token.line_height !== lineHeight) {
            return;
        }

        return {
            type: "typography",
            name: tokenName,
            nameComponentTypography: platform === "web" ? buildTypographyComponent(token, styleName) : "",
            nameComponentText: platform === "web" ? buildTextComponent(token, tokenName) : "",
            nameMixin: platform === "web" ? buildMixin(token, tokenName) : "",
            meta: token,
        } as const;
    }
}

function buildTypographyComponent(meta: TypographyToken["meta"], styleName: string) {
    const { groupName, size } = parseTypographyStyle(styleName);

    let typographyComponent = /headline|promo/i.test(groupName) ? TITLE_COMPONENT : TEXT_COMPONENT;

    if (/key/i.test(groupName)) {
        return "Компонент для этого стиля отсутствует";
    }

    if (groupName.toLowerCase().includes("mobile")) {
        typographyComponent = TITLE_MOBILE_COMPONENT;
    }

    const props: Record<string, unknown> = {
        view: toDashCase(size),
    };

    if (typographyComponent !== TEXT_COMPONENT && /styrene/i.test(meta.font_family) === false) {
        props.font = "system";
    }

    if (meta.text_transform === "uppercase") {
        props.view = "caps";
    }

    if (meta.monospace) {
        props.monospaceNumbers = true;
    }

    if (typographyComponent === TITLE_COMPONENT) {
        if (props.font === "system") {
            // Все стили для заголовков имеют жирность 700
            if (meta.font_weight === 400) {
                props.weight = "regular";
            }

            if (meta.font_weight === 500) {
                props.weight = "medium";
            }

            if (meta.font_weight === 600) {
                props.weight = "semibold";
            }
        } else {
            //  Все стили для заголовков имеют жирность 500
            if (meta.font_weight === 400) {
                props.weight = "regular";
            }

            if (meta.font_weight === 600) {
                props.weight = "semibold";
            }

            if (meta.font_weight === 700) {
                props.weight = "bold";
            }
        }
    }

    if (typographyComponent === TITLE_MOBILE_COMPONENT) {
        if (props.font === "system") {
            // Все стили для мобильных заголовков имеют жирность 600
            if (meta.font_weight === 400) {
                props.weight = "regular";
            }

            if (meta.font_weight === 500) {
                props.weight = "medium";
            }

            if (meta.font_weight === 700) {
                props.weight = "bold";
            }
        } else {
            //  Все стили для мобильных заголовков имеют жирность 500
            if (meta.font_weight === 400) {
                props.weight = "regular";
            }

            if (meta.font_weight === 600) {
                props.weight = "semibold";
            }

            if (meta.font_weight === 700) {
                props.weight = "bold";
            }
        }
    }

    if (typographyComponent === TEXT_COMPONENT) {
        // Все стили для текста имеют жирность 400

        if (meta.font_weight === 500) {
            props.weight = "medium";
        }

        if (meta.font_weight === 600) {
            props.weight = "semibold";
        }

        if (meta.font_weight === 700) {
            props.weight = "bold";
        }
    }

    const propsString = Object.entries(props)
        .map(([key, value]) => {
            if (typeof value === "string") {
                return `${key}="${value}"`;
            }

            return `${key}={${JSON.stringify(value)}}`;
        })
        .join(" ");

    return `<Typography.${typographyComponent} ${propsString}>Текст</Typography.${typographyComponent}>`;
}

function buildTextComponent(_meta: TypographyToken["meta"], tokenName: string) {
    return `<Text view='${toDashCase(tokenName)}'>Текст</Text>`;
}

function buildMixin(meta: TypographyToken["meta"], tokenName: string) {
    if (meta.monospace) {
        return "Отсутствует миксин для моноширинных шрифтов";
    }

    return `@mixin ${tokenName};`;
}

function parseTypographyStyle(styleName: string) {
    const [groupName, sizePart] = styleName.split("/").map((part) => part.trim());

    const m = /(\d+-\d+)\s?/.exec(sizePart);
    const numericSize = m ? m[1] : "";

    const [fontSize, lineHeight] = numericSize.split("-").map(Number);

    const size = sizePart
        .replace(numericSize, "")
        .replace(/\(.*\)/, "")
        .replace(/\[.*\]/, "")
        .trim();

    return {
        groupName,
        fontSize,
        lineHeight,
        size,
    };
}

export function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPascalCase(str: string) {
    return str
        .split(/[\s_-]/)
        .map((word) => capitalize(word))
        .join("");
}

function toDashCase(str: string) {
    return str
        .split(/[\s_-]/)
        .map((word) => word.toLowerCase())
        .join("-");
}

function toSnakeCase(str: string) {
    return str
        .split(/[\s_-]/)
        .map((word) => word.toLowerCase())
        .join("_");
}
