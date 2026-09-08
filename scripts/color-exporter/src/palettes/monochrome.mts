import type { Rule } from '../contract.mjs';

export default {
    section: /^(?:(?:light|dark)\/monochrome-(?:black|white)(?:_inverted)?|static_monochrome-(?:black|white))$/,
    frame: /^[0-9]+$/, defaultOnly: true,
} satisfies Rule;
