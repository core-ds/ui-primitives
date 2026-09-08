import type { Rule } from '../contract.mjs';

export default { section: /^(?:light|dark)\/qualitative-(?:flexible|monocolor|(?:duocolor|tricolor|tetracolor)\/set-[a-z0-9-]+)$/, defaultOnly: true } satisfies Rule;
