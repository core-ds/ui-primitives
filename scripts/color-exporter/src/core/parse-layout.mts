import { assertExactKeys, invariant, isPlainObject } from './assertions.mjs';
import { formatRectangleColor } from './format-color.mjs';
import { assertTokenKey, compareCodeUnits } from './stable-order.mjs';
import { validateCanonicalToken } from './token-contract.mjs';
import { TokenSourceRegistry } from './token-sources.mjs';
import type {
    CanonicalColorToken,
    FigmaNode,
    FigmaRectangleNode,
    LayoutCounts,
    PaletteDefinition,
    ParsedPalette,
} from './types.mjs';

const EXPORT_PAGE_NAME = /^colors_[a-z0-9_]+\.json$/;

function requireNamedNode(node: unknown, expectedType: string, description: string): FigmaNode {
    invariant(isPlainObject(node), `${description} должен быть объектом`);
    invariant(node.type === expectedType, `${description} должен иметь тип ${expectedType}`);
    invariant(typeof node.name === 'string' && node.name.length > 0, `${description} должен иметь непустое имя`);
    return node as FigmaNode;
}

function requireChildren(node: FigmaNode, description: string): unknown[] {
    invariant(Array.isArray(node.children) && node.children.length > 0, `${description} не содержит дочерних узлов`);
    return node.children;
}

function displayedNodeName(node: unknown): string {
    return isPlainObject(node) && typeof node.name === 'string' ? node.name : '<без имени>';
}

function figmaPages(figmaFile: unknown): unknown[] {
    invariant(isPlainObject(figmaFile), 'ответ Figma должен быть объектом');
    invariant(isPlainObject(figmaFile.document), 'ответ Figma не содержит документа');
    const pages = figmaFile.document.children;
    invariant(Array.isArray(pages), 'ответ Figma не содержит страниц документа');
    return pages;
}

function findPalettePage(figmaFile: unknown, pageName: string): FigmaNode {
    const pages = figmaPages(figmaFile);

    const matchingPages = pages.filter((page) => isPlainObject(page) && page.name === pageName);
    invariant(
        matchingPages.length === 1,
        `ожидалась ровно одна страница ${pageName}, найдено ${matchingPages.length}`,
    );
    return requireNamedNode(matchingPages[0], 'CANVAS', `страница ${pageName}`);
}

/** Возвращает стабильный список страниц, которые считаются цветовыми JSON. */
export function listExportPalettePageNames(figmaFile: unknown): string[] {
    const names = figmaPages(figmaFile)
        .flatMap((page) => {
            if (!isPlainObject(page)
                || typeof page.name !== 'string'
                || !EXPORT_PAGE_NAME.test(page.name)) return [];
            return [page.name];
        })
        .sort(compareCodeUnits);
    invariant(new Set(names).size === names.length, 'ответ Figma содержит повторяющиеся экспортные страницы');
    return names;
}

/** Проверяет наличие одной настроенной страницы, не считая отсутствие ошибкой. */
export function hasFigmaPalettePage(figmaFile: unknown, pageName: string): boolean {
    const matchingPages = figmaPages(figmaFile)
        .filter((page) => isPlainObject(page) && page.name === pageName);
    invariant(matchingPages.length <= 1, `ожидалась не более одной страницы ${pageName}, найдено ${matchingPages.length}`);
    if (matchingPages.length === 0) return false;
    requireNamedNode(matchingPages[0], 'CANVAS', `страница ${pageName}`);
    return true;
}

interface ParseFrameOptions {
    frame: FigmaNode;
    sectionName: string;
    palette: PaletteDefinition;
    stateRanks: ReadonlyMap<string, number>;
    tokens: Map<string, CanonicalColorToken>;
    sources: TokenSourceRegistry;
    counts: LayoutCounts;
}

function parseFrame({
    frame,
    sectionName,
    palette,
    stateRanks,
    tokens,
    sources,
    counts,
}: ParseFrameOptions): void {
    const framePath = `${sectionName}/${frame.name}`;
    const rectangles = requireChildren(frame, `фрейм ${framePath}`);
    const seenStates = new Set<string>();
    const orderedStates: string[] = [];
    let previousStateIndex = -1;

    for (const candidate of rectangles) {
        const rectangle = requireNamedNode(
            candidate,
            'RECTANGLE',
            `узел ${framePath}/${displayedNodeName(candidate)}`,
        ) as FigmaRectangleNode;
        counts.rectangles += 1;

        // `empty` существует только для визуальной раскладки Figma. Ядро не
        // читает его свойства и не передаёт узел правилам конкретной палитры.
        if (rectangle.name === 'empty') {
            counts.placeholders += 1;
            continue;
        }

        const stateName = rectangle.name;
        invariant(stateRanks.has(stateName), `неизвестное состояние ${framePath}/${stateName}`);
        invariant(!seenStates.has(stateName), `состояние ${framePath}/${stateName} повторяется`);

        const stateIndex = stateRanks.get(stateName);
        invariant(stateIndex !== undefined, `не удалось определить порядок состояния ${framePath}/${stateName}`);
        invariant(
            stateIndex > previousStateIndex,
            `состояния ${framePath} должны идти в порядке ${palette.stateNames.join(', ')}`,
        );
        previousStateIndex = stateIndex;
        seenStates.add(stateName);
        orderedStates.push(stateName);

        const identity = palette.deriveIdentity({
            sectionName,
            frameName: frame.name,
            stateName,
        });
        assertExactKeys(identity, ['key', 'figma', 'mode'], `идентификатор ${framePath}/${stateName}`);
        assertTokenKey(identity.key);
        invariant(
            typeof identity.figma === 'string' && identity.figma.length > 0,
            `путь Figma для ${identity.key} должен быть непустой строкой`,
        );
        invariant(
            typeof identity.mode === 'string' && identity.mode.length > 0,
            `режим для ${identity.key} должен быть непустой строкой`,
        );

        const color = formatRectangleColor(rectangle);
        const token = palette.makeToken({
            identity,
            color,
            sectionName,
            frameName: frame.name,
            stateName,
        });
        validateCanonicalToken(token, identity);
        sources.register(identity, token, {
            pageName: palette.figma.pageName,
            sectionName,
            frameName: frame.name,
            stateName,
            nodeId: typeof rectangle.id === 'string' ? rectangle.id : undefined,
        });
        tokens.set(identity.key, token);
    }

    invariant(orderedStates.length > 0, `${framePath} не содержит ни одного цветового состояния`);
    palette.validateFrameComposition({
        sectionName,
        frameName: frame.name,
        stateNames: orderedStates,
    });
}

/**
 * Разбирает одну страницу Figma по общему структурному контракту.
 *
 * Ядро знает только типы узлов SECTION -> FRAME -> RECTANGLE. Все правила
 * конкретных имён и преобразований передаются подключаемым модулем палитры.
 */
export function parseFigmaPalette(figmaFile: unknown, palette: PaletteDefinition): ParsedPalette {
    const page = findPalettePage(figmaFile, palette.figma.pageName);
    const sections = requireChildren(page, `страница ${palette.figma.pageName}`);

    const tokens = new Map<string, CanonicalColorToken>();
    const sources = new TokenSourceRegistry();
    const counts: LayoutCounts = {
        sections: 0,
        frames: 0,
        rectangles: 0,
        placeholders: 0,
        tokens: 0,
    };
    const stateRanks = new Map(palette.stateNames.map((stateName, index) => [stateName, index]));
    const seenSectionNames = new Set<string>();

    for (const candidate of sections) {
        const section = requireNamedNode(
            candidate,
            'SECTION',
            `верхний узел ${displayedNodeName(candidate)}`,
        );
        palette.validateSectionName(section.name);
        invariant(!seenSectionNames.has(section.name), `секция ${section.name} повторяется`);
        seenSectionNames.add(section.name);
        const frames = requireChildren(section, `секция ${section.name}`);
        counts.sections += 1;
        const seenFrameNames = new Set<string>();

        for (const candidateFrame of frames) {
            const frame = requireNamedNode(
                candidateFrame,
                'FRAME',
                `узел ${section.name}/${displayedNodeName(candidateFrame)}`,
            );
            palette.validateFrameName(frame.name);
            invariant(!seenFrameNames.has(frame.name), `фрейм ${section.name}/${frame.name} повторяется`);
            seenFrameNames.add(frame.name);
            counts.frames += 1;
            parseFrame({ frame, sectionName: section.name, palette, stateRanks, tokens, sources, counts });
        }
    }

    counts.tokens = tokens.size;
    return { tokens, counts };
}
