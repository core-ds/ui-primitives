import { GetFileResponse, Node } from "@figma/rest-api-spec";

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

export function walkNodes(nodes: Node[], callback: (n: Node) => void): void {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;

        callback(node);

        if ("children" in node) {
            walkNodes(node.children, callback);
        }
    }
}

export function sortEntries<T extends [name: string, value: unknown]>(entries: T[]): T[] {
    return Array.from(entries).sort(([aName], [bName]) => aName.localeCompare(bName));
}

export async function fetchFile(fileKey: string): Promise<GetFileResponse> {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: { "X-FIGMA-TOKEN": process.env.FIGMA_TOKEN },
    });

    return response.json();
}

export function handleLetterSpacing(letterSpacing: number | undefined): number | undefined {
    if (letterSpacing) {
        return parseFloat(letterSpacing.toFixed(2));
    }
}
