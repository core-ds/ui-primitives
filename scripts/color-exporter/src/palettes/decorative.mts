import type { Rule } from '../contract.mjs';

export default {
    section: /^(?:light|dark)\/decorative(?:-(?:soft|muted-alt|muted|text))?(?:_inverted)?$/,
    defaultOnly: (section, frame) => section.includes('decorative-text') || ['red', 'yellow'].includes(frame),
} satisfies Rule;
