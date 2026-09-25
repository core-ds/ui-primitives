import type { Rule } from '../contract.mjs';

/** Актуальные пути SuperApp экспортируются как есть; только alias сохраняет прежнее имя. */
export default {
    aliasNames: (section, frame) => {
        const family = /^((?:light|dark)\/superapp-(?:surface|component))(_inverted)?$/.exec(section);
        if (!family || !frame.startsWith('bg-') || frame.length <= 3) return undefined;
        return { section: `${family[1]}-bg${family[2] ?? ''}`, frame: frame.slice(3) };
    },
} satisfies Rule;
