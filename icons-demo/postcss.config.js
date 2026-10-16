import postcssImport from 'postcss-import';
import postcssPresetEnv from 'postcss-preset-env';
import postcssMixins from 'postcss-mixins';

const config = {
    plugins: [
        postcssImport(),
        postcssPresetEnv({
            stage: 3,
            features: {
                'nesting-rules': true,
                'custom-properties': false,
            },
        }),
        postcssMixins(),
    ],
};

export default config;
