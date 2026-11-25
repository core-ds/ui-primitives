import { defineConfig } from 'lint-filename';

export default defineConfig([
    {
        files: 'lottie/glyph-26/*.json',
        pattern: /^glyph-26_[a-z0-9]+(-[a-z0-9]+)*_(20|24|32)_hover\.json$/,
    },
]);
