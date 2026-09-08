import type { Rule } from '../contract.mjs';

export default { section: /^(?:(?:light|dark)\/[a-z0-9_-]+|static_[a-z0-9_-]+)(?:_inverted)?$/ } satisfies Rule;
