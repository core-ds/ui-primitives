import { parseDocument } from 'htmlparser2';
import * as domhandler from 'domhandler';
import { Plugin, PluginContext } from './index.mjs';

export interface Problem {
    index: number;
    severity: 'error' | 'warning';
    message: string;
    plugin: string;
}

export async function verify(filename: string, content: string, plugins: Plugin[] | undefined = []) {
    const problems: Problem[] = [];
    const visitors = plugins.map(
        (plugin) =>
            [
                plugin,
                {
                    filename,
                    content,
                    error: (message, node) => {
                        problems.push({
                            severity: 'error',
                            plugin: plugin.plugin,
                            index: node.startIndex ?? 0,
                            message,
                        });
                    },
                    warning: (message, node) => {
                        problems.push({
                            severity: 'warning',
                            plugin: plugin.plugin,
                            index: node.startIndex ?? 0,
                            message,
                        });
                    },
                },
            ] satisfies [Plugin, PluginContext]
    );

    async function traverse(node: domhandler.AnyNode) {
        await Promise.all(visitors.map(([plugin, context]) => visit(plugin, context, node)));

        if (domhandler.hasChildren(node)) {
            for (const child of node.children) {
                await traverse(child);
            }
        }

        await Promise.all(visitors.map(([plugin, context]) => visit(plugin, context, node, 'Exit')));
    }

    await traverse(parseDocument(content, { xmlMode: true, withStartIndices: true }));

    return problems.sort((a, b) => a.index - b.index);
}

function visit(plugin: Plugin, context: PluginContext, node: domhandler.AnyNode, phase: '' | 'Exit' = '') {
    let result: void | Promise<void> = undefined;

    if (domhandler.isDocument(node)) {
        result = plugin[`Root${phase}`]?.(node, context);
    } else if (domhandler.isText(node)) {
        result = plugin[`Text${phase}`]?.(node, context);
    } else if (domhandler.isDirective(node)) {
        result = plugin[`Directive${phase}`]?.(node, context);
    } else if (domhandler.isComment(node)) {
        result = plugin[`Comment${phase}`]?.(node, context);
    } else if (domhandler.isTag(node)) {
        result = plugin[`Tag${phase}`]?.(node, context);
    } else if (domhandler.isCDATA(node)) {
        result = plugin[`CDATA${phase}`]?.(node, context);
    }

    return Promise.resolve(result);
}
