import type { Rule } from '../contract.mjs';

export default { section: /^(?:light|dark)\/sequential-[a-z0-9-]+$/, defaultOnly: true } satisfies Rule;
