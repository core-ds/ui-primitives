import { Node } from "@figma/rest-api-spec";

export function findNode<T extends Node>(nodes: Node[], predicate: (n: Node) => n is T): T | undefined {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;

        if (predicate(node)) {
            return node;
        }

        if ("children" in node) {
            const child = findNode(node.children, predicate);

            if (child) {
                return child;
            }
        }
    }
}
