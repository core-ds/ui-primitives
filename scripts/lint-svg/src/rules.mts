import path from 'node:path';
import { parseDocument } from 'htmlparser2';
import { type Document, type Element, isTag } from 'domhandler';
import { ForbiddenElement, Rules, Severity } from './index.mjs';

type Node = Document | Element;

export interface Problem {
    index: number;
    severity: Exclude<Severity, 'off'>;
    message: string;
    rule: keyof Rules;
}

interface RuleContext<Options> {
    filename: string;
    options: Options;
    report(descriptor: { node: Node; message: string }): void;
}

/**
 * Like in ESLint, keys are node types: `Document` for the root, the tag name for elements.
 * A `:exit` suffix is called when leaving the node.
 */
type Visitor = Record<string, (node: Node) => void>;

interface RuleModule<Options> {
    create(context: RuleContext<Options>): Visitor;
}

type RuleOptions<Name extends keyof Rules> = Exclude<NonNullable<Rules[Name]>, string>[1];

const rules: { [Name in keyof Rules]-?: RuleModule<RuleOptions<Name>> } = {
    filename: {
        create(context) {
            return {
                Document(node) {
                    const { pattern } = context.options!;
                    const filename = path.basename(context.filename);

                    if (!pattern.test(filename)) {
                        context.report({ node, message: `Filename "${filename}" does not match ${pattern}` });
                    }
                },
            };
        },
    },
    'forbidden-element': {
        create(context) {
            const elements: ForbiddenElement[] = ['clipPath', 'mask', 'linearGradient', 'radialGradient'];
            const allow = context.options?.allow ?? [];

            return Object.fromEntries(
                elements
                    .filter((element) => !allow.includes(element))
                    .map((element) => [
                        element,
                        (node: Node) => context.report({ node, message: `Unexpected <${element}> element` }),
                    ])
            );
        },
    },
};

/**
 * Walks the document and calls visitors of every enabled rule for each node.
 */
export function verify(filename: string, content: string, config: Rules) {
    const problems: Problem[] = [];
    const visitors: Visitor[] = [];

    for (const [rule, value] of Object.entries(config) as Array<[keyof Rules, NonNullable<Rules[keyof Rules]>]>) {
        const [severity, options] = typeof value === 'string' ? [value] : value;

        if (severity !== 'off') {
            visitors.push(
                (rules[rule] as RuleModule<unknown>).create({
                    filename,
                    options,
                    report: ({ node, message }) =>
                        problems.push({ index: node.startIndex ?? 0, severity, message, rule }),
                })
            );
        }
    }

    const emit = (key: string, node: Node) => visitors.forEach((visitor) => visitor[key]?.(node));
    const visit = (type: string, node: Node) => {
        emit(type, node);

        for (const child of node.children) {
            if (isTag(child)) {
                visit(child.name, child);
            }
        }

        emit(`${type}:exit`, node);
    };

    visit('Document', parseDocument(content, { xmlMode: true, withStartIndices: true }));

    return problems.sort((a, b) => a.index - b.index);
}
