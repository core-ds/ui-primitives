import type * as domhandler from 'domhandler';
import path from 'node:path';

export interface PluginContext {
    filename: string;
    content: string;
    error(message: string, node: domhandler.AnyNode): void;
    warning(message: string, node: domhandler.AnyNode): void;
}

export interface Plugin {
    plugin: string;
    Root?: (node: domhandler.Document, context: PluginContext) => void | Promise<void>;
    RootExit?: (node: domhandler.Document, context: PluginContext) => void | Promise<void>;
    Text?: (node: domhandler.Text, context: PluginContext) => void | Promise<void>;
    TextExit?: (node: domhandler.Text, context: PluginContext) => void | Promise<void>;
    Directive?: (node: domhandler.ProcessingInstruction, context: PluginContext) => void | Promise<void>;
    DirectiveExit?: (node: domhandler.ProcessingInstruction, context: PluginContext) => void | Promise<void>;
    Comment?: (node: domhandler.Comment, context: PluginContext) => void | Promise<void>;
    CommentExit?: (node: domhandler.Comment, context: PluginContext) => void | Promise<void>;
    Tag?: (node: domhandler.Element, context: PluginContext) => void | Promise<void>;
    TagExit?: (node: domhandler.Element, context: PluginContext) => void | Promise<void>;
    CDATA?: (node: domhandler.CDATA, context: PluginContext) => void | Promise<void>;
    CDATAExit?: (node: domhandler.CDATA, context: PluginContext) => void | Promise<void>;
}

export type PluginCreator<T = undefined> = (options: T) => Plugin;

export interface Config {
    /**
     * Glob pattern(s) relative to the working directory. If omitted, the object applies to every file.
     */
    files?: string | string[];
    /**
     * Glob pattern(s) relative to the working directory. In an object without other keys the patterns are
     * global, i.e. matching files are not linted at all.
     */
    ignore?: string | string[];
    plugins?: Plugin[];
}

export function defineConfig(config: Config): Config;
export function defineConfig(config: Config[]): Config[];
export function defineConfig(config: Config | Config[]) {
    return config;
}

export const filenamePlugin: PluginCreator<{ pattern: RegExp }> = ({ pattern }) => {
    return {
        plugin: 'filename',
        Root: (node, context) => {
            const filename = path.basename(context.filename);

            if (!pattern.test(filename)) {
                context.error(`Filename "${filename}" does not match ${pattern}`, node);
            }
        },
    };
};

export const forbiddenElementPlugin: PluginCreator<{ forbidden: string[] }> = ({ forbidden }) => {
    return {
        plugin: 'forbidden-element',
        Tag: (node, context) => {
            if (forbidden.includes(node.name)) {
                context.warning(`Unexpected <${node.name}> element`, node);
            }
        },
    };
};
