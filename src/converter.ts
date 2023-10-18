type Tokens = Record<"web" | "mob" | "figma" | "token", string>;

export function convert(styleName: string, platform: Platform) {
    let meta;
    let tokens;

    try {
        meta = parseStyleName(styleName);
        tokens = generateTokens(meta);
    } catch (e) {
        let mode = "light";
        if (styleName.startsWith("static_")) {
            styleName = styleName.replace("static_", "");
            mode = "static";
        }

        meta = parseVariableName(styleName);

        tokens = generateTokens({
            mode,
            bundle: [meta.bundle, meta.bundleSet].filter(Boolean).join("-"),
            modifiers: meta.modifiers,
            nameParts: meta.name.split("_"),
            styleName: styleName,
        });
    }

    if (platform === "mobile") {
        return tokens.mob;
    }

    return `var(${tokens.web})`;
}

function parseStyleName(rawStyleName: string) {
    const styleName = rawStyleName.replace(/\s.*/, "");

    const m = /[^a-z-/]/i.exec(styleName);

    if (m) {
        throw new Error(`Недопустимые символы в названии: ${m[0]}`);
    }

    const [mode, bundlePart, namePart] = styleName.split("/");

    if (/light|dark|static/.test(mode) === false) {
        throw new Error(`Недопустимый режим: ${mode}`);
    }

    const [bundle, ...modifiers] = bundlePart.split("-");
    const nameParts = (namePart || "").split("-");

    return {
        mode,
        bundle,
        modifiers,
        nameParts,
        styleName,
    };
}

function parseVariableName(styleName: string) {
    let rawBundle = "";
    let bundle = "";
    let bundleSet = "";
    let modifier = "";
    let name = "";

    const parts = styleName.split("/");

    if (parts.length < 2) {
        throw new Error(`Недопустимый формат: ${styleName}`);
    }

    if (parts.length === 2) {
        [rawBundle, name] = parts;
        [bundle, modifier] = rawBundle.split("_");
    }

    if (parts.length === 3) {
        [rawBundle, bundleSet, name] = parts;
        [bundle, modifier] = rawBundle.split("_");
    }

    const modifiers = modifier ? modifier.split("-") : [];

    if (/hover|active|press/.test(name)) {
        modifiers.unshift(bundleSet);
        modifiers.push(name);

        bundleSet = "";
        name = "";
    }

    return {
        bundle,
        bundleSet,
        modifiers,
        name,
    };
}

function generateTokens(meta: ReturnType<typeof parseStyleName>): Tokens {
    const mobileBundleAliases: Record<string, string> = {
        bg: "background",
        specialbg: "specialBackground",
    };

    let mobileBundle = meta.bundle
        .split("-")
        .map((s, i) => (i === 0 ? s : capitalize(s)))
        .join("");

    if (mobileBundle in mobileBundleAliases) {
        mobileBundle = mobileBundleAliases[mobileBundle];
    }

    /**
     * figma: "light/bg-base-inverted/primary-alternative"
     * mobile: "backgroundPrimaryAlternativeBaseInverted"
     * token: "light_bg_primary_alternative_base_inverted"
     * web: "--color-light-bg-primary-alternative-base-inverted"
     */

    return {
        figma: meta.styleName,
        token: [meta.mode, meta.bundle, ...meta.nameParts, ...meta.modifiers]
            .filter(Boolean)
            .join("_")
            .replace(/-/g, "_"),
        web: ["--color", meta.mode, meta.bundle, meta.nameParts.join("-"), meta.modifiers.join("-")]
            .filter(Boolean)
            .join("-")
            .replace(/_/g, "-"),
        mob: [
            meta.mode === "static" ? `static${capitalize(mobileBundle)}` : mobileBundle,
            "Color",
            ...meta.nameParts.map(capitalize),
            ...meta.modifiers.map(capitalize),
        ].join(""),
    };
}

export function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
