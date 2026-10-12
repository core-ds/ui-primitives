import path from 'node:path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @type {import('webpack').Configuration}
 */
const config = {
    experiments: {
        css: true,
    },
    entry: './src/index.tsx',
    mode: process.env.NODE_ENV,
    devtool: 'source-map',
    module: {
        parser: {
            'css/auto': {
                dashedIdents: false,
                namedExports: false,
            },
            'css/module': {
                dashedIdents: false,
                namedExports: false,
            },
        },
        generator: {
            'css/auto': {
                localIdentName: '[name]__[local]--[hash:base64:5]',
            },
        },
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                enforce: 'pre',
                test: /\.js$/,
                loader: 'source-map-loader',
            },
            {
                test: /\.css$/,
                type: 'css/auto',
                use: [
                    {
                        loader: 'postcss-loader',
                        options: {
                            sourceMap: true,
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
    output: {
        filename: '[name].[fullhash].js',
        path: path.resolve(__dirname, 'dist'),
    },
    optimization: {
        splitChunks: {
            cacheGroups: {
                icons: {
                    test: /[\\/]node_modules[\\/](@alfalab\/icons)[\\/]/,
                    name: 'icons',
                    chunks: 'all',
                },
                core_components: {
                    test: /[\\/]node_modules[\\/](@alfalab\/core-components)[\\/]/,
                    name: 'core-components',
                    chunks: 'all',
                },
            },
        },
    },
    devServer: {
        static: path.join(__dirname),
        compress: true,
        port: 3000,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'public/index.html',
            filename: 'index.html',
        }),
        new webpack.NormalModuleReplacementPlugin(/^@alfalab\/icons-*/, (resoveData) => {
            resoveData.request = resoveData.request.replace(
                /^@alfalab\/icons-([^/]+)\/(.*)/,
                '@alfalab/icons-$1/dist/$2'
            );
        }),
    ],
};

export default config;
