import type { Rule } from '../contract.mjs';

export default {
    section: /^(?:(?:light|dark)\/promo(?:-(?:muted|pale|vibrant))?|static_promo)$/,
    defaultOnly: (section) => section === 'static_promo',
} satisfies Rule;
