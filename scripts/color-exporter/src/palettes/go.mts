import type { Rule } from '../contract.mjs';

export default { section: /^(?:(?:light|dark)\/go|static_go)$/, defaultOnly: true } satisfies Rule;
