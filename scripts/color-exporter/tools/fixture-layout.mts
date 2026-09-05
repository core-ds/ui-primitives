import { invariant, isPlainObject } from '../src/core/assertions.mjs';
import { compareCodeUnits } from '../src/core/stable-order.mjs';
import { validateCanonicalToken } from '../src/core/token-contract.mjs';
import type {
    CanonicalColorToken,
    IdentityContext,
    JsonObject,
    PaletteDefinition,
} from '../src/core/types.mjs';

export const SANITIZED_STYLE_ID = 'StyleID:обезличено';
export const SANITIZED_VARIABLE_ID = 'VariableID:обезличено';

function requireVariableAlias(alias: unknown, description: string): JsonObject {
    invariant(isPlainObject(alias), `${description} должна быть объектом`);
    invariant(alias.type === 'VARIABLE_ALIAS', `${description} должна иметь тип VARIABLE_ALIAS`);
    invariant(typeof alias.id === 'string' && alias.id.length > 0, `${description} должна иметь непустой id`);
    return alias;
}

function requireNode(node: unknown, type: string, description: string): JsonObject {
    invariant(isPlainObject(node), `${description} должен быть объектом`);
    invariant(node.type === type, `${description} должен иметь тип ${type}`);
    invariant(typeof node.name === 'string' && node.name.length > 0, `${description} должен иметь имя`);
    return node;
}

function requireChildren(node: JsonObject, description: string): unknown[] {
    invariant(Array.isArray(node.children), `${description} должен содержать массив children`);
    return node.children;
}

function sanitizePaint(paint: unknown): JsonObject {
    invariant(isPlainObject(paint), 'заливка Figma должна быть объектом');
    const sanitized: JsonObject = { type: paint.type };
    if (paint.visible !== undefined) sanitized.visible = paint.visible;
    if (paint.opacity !== undefined) sanitized.opacity = paint.opacity;
    if (paint.color !== undefined) {
        invariant(isPlainObject(paint.color), 'цвет заливки Figma должен быть объектом');
        sanitized.color = {
            r: paint.color.r,
            g: paint.color.g,
            b: paint.color.b,
            ...(paint.color.a === undefined ? {} : { a: paint.color.a }),
        };
    }
    if (paint.boundVariables !== undefined) {
        invariant(isPlainObject(paint.boundVariables), 'boundVariables заливки должен быть объектом');
        if (paint.boundVariables.color !== undefined) {
            requireVariableAlias(paint.boundVariables.color, 'переменная цвета заливки');
            sanitized.boundVariables = {
                color: {
                    type: 'VARIABLE_ALIAS',
                    id: SANITIZED_VARIABLE_ID,
                },
            };
        }
    }
    return sanitized;
}

function sanitizeRectangle(node: unknown, path: string): JsonObject {
    const rectangle = requireNode(node, 'RECTANGLE', path);
    // `empty` не является источником данных: слепок сохраняет только имя,
    // нужное рабочему парсеру для безусловного пропуска узла.
    if (rectangle.name === 'empty') {
        return {
            type: 'RECTANGLE',
            name: 'empty',
        };
    }
    invariant(Array.isArray(rectangle.fills), `${path}: fills должен быть массивом`);
    const sanitized: JsonObject = {
        type: 'RECTANGLE',
        name: rectangle.name,
        fills: rectangle.fills.map(sanitizePaint),
    };
    if (rectangle.opacity !== undefined) sanitized.opacity = rectangle.opacity;
    if (rectangle.styles !== undefined) {
        invariant(isPlainObject(rectangle.styles), `${path}: styles должен быть объектом`);
        if (rectangle.styles.fill !== undefined) {
            invariant(
                typeof rectangle.styles.fill === 'string' && rectangle.styles.fill.length > 0,
                `${path}: идентификатор цветового стиля Figma должен быть непустой строкой`,
            );
            sanitized.styles = { fill: SANITIZED_STYLE_ID };
        }
    }
    if (rectangle.boundVariables !== undefined) {
        invariant(isPlainObject(rectangle.boundVariables), `${path}: boundVariables должен быть объектом`);
        if (rectangle.boundVariables.fills !== undefined) {
            invariant(Array.isArray(rectangle.boundVariables.fills), `${path}: boundVariables.fills должен быть массивом`);
            sanitized.boundVariables = {
                fills: rectangle.boundVariables.fills.map((alias) => {
                    requireVariableAlias(alias, `${path}: переменная заливки`);
                    return { type: 'VARIABLE_ALIAS', id: SANITIZED_VARIABLE_ID };
                }),
            };
        }
    }
    return sanitized;
}

function sanitizePage(page: unknown, pageName: string): JsonObject {
    const canvas = requireNode(page, 'CANVAS', `страница ${pageName}`);
    return {
        type: 'CANVAS',
        name: canvas.name,
        children: requireChildren(canvas, `страница ${pageName}`).map((sectionNode) => {
            const section = requireNode(sectionNode, 'SECTION', `секция страницы ${pageName}`);
            const sectionName = String(section.name);
            return {
                type: 'SECTION',
                name: sectionName,
                children: requireChildren(section, `секция ${sectionName}`).map((frameNode) => {
                    const frame = requireNode(frameNode, 'FRAME', `фрейм секции ${sectionName}`);
                    const frameName = String(frame.name);
                    return {
                        type: 'FRAME',
                        name: frameName,
                        children: requireChildren(frame, `фрейм ${sectionName}/${frameName}`).map(
                            (rectangle) => sanitizeRectangle(rectangle, `${sectionName}/${frameName}`),
                        ),
                    };
                }),
            };
        }),
    };
}

/** Удаляет идентификаторы, пользователей и метаданные из полного ответа REST. */
export function sanitizeFigmaFixture(
    figmaFile: unknown,
    palettes: readonly PaletteDefinition[],
): JsonObject {
    invariant(isPlainObject(figmaFile) && isPlainObject(figmaFile.document), 'ответ Figma не содержит document');
    invariant(Array.isArray(figmaFile.document.children), 'ответ Figma не содержит страницы');
    const pages = figmaFile.document.children;
    return {
        document: {
            children: palettes.map((palette) => {
                const matches = pages.filter((page) => isPlainObject(page) && page.name === palette.figma.pageName);
                invariant(matches.length === 1, `страница ${palette.figma.pageName} должна встречаться ровно один раз`);
                return sanitizePage(matches[0], palette.figma.pageName);
            }),
        },
    };
}

function sectionCandidates(family: string, tokenKey: string): string[] {
    const variableModes = ['light', 'dark'];
    const inferredMode = variableModes.find((mode) => tokenKey.startsWith(`${mode}_`));
    const orderedModes = inferredMode === undefined
        ? variableModes
        : [inferredMode, ...variableModes.filter((mode) => mode !== inferredMode)];
    // Сначала проверяем путь без изменений. Затем добавляем режим переменной Figma.
    // Сам путь не перекодируется: внутренние `/`, `_` и `-` сохраняются ровно
    // такими, какими они записаны в поле `figma`.
    return [family, ...orderedModes.map((mode) => `${mode}/${family}`)];
}

function identityMatches(
    palette: PaletteDefinition,
    context: IdentityContext,
    key: string,
    figmaPath: string,
): boolean {
    try {
        palette.validateSectionName(context.sectionName);
        palette.validateFrameName(context.frameName);
        const identity = palette.deriveIdentity(context);
        return identity.key === key && identity.figma === figmaPath;
    } catch {
        return false;
    }
}

function resolveIdentityContext(
    palette: PaletteDefinition,
    key: string,
    figmaPath: string,
): IdentityContext {
    const parts = figmaPath.split('/');
    invariant(parts.length >= 2 && parts.every(Boolean), `${key}: неправильный путь Figma ${figmaPath}`);
    const pathCandidates: Array<{ stateName: string; frameIndex: number }> = [{
        stateName: 'default',
        frameIndex: parts.length - 1,
    }];
    for (const stateName of palette.stateNames) {
        if (stateName !== 'default' && parts.at(-1) === stateName && parts.length >= 3) {
            pathCandidates.push({ stateName, frameIndex: parts.length - 2 });
        }
    }

    const matches: IdentityContext[] = [];
    for (const { stateName, frameIndex } of pathCandidates) {
        const frameName = parts[frameIndex];
        invariant(frameName !== undefined, `${key}: не удалось определить имя фрейма`);
        const family = parts.slice(0, frameIndex).join('/');
        for (const sectionName of sectionCandidates(family, key)) {
            const context = { sectionName, frameName, stateName };
            if (identityMatches(palette, context, key, figmaPath)) matches.push(context);
        }
    }

    const uniqueMatches = new Map(matches.map((match) => [JSON.stringify(match), match]));
    invariant(uniqueMatches.size === 1, `${key}: ожидался один обратный путь из figma, найдено ${uniqueMatches.size}`);
    const context = uniqueMatches.values().next().value;
    invariant(context !== undefined, `${key}: не удалось восстановить положение в раскладке`);
    return context;
}

function rectangleFromToken(token: CanonicalColorToken, stateName: string): JsonObject {
    const match = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(token.rgba);
    invariant(match !== null, `не удалось разобрать ${token.rgba}`);
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    const alpha = Number(match[4]);
    invariant(
        [red, green, blue].every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255),
        `недопустимый RGB в ${token.rgba}`,
    );
    invariant(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1, `недопустимая альфа в ${token.rgba}`);
    return {
        type: 'RECTANGLE',
        name: stateName,
        styles: {
            fill: SANITIZED_STYLE_ID,
        },
        fills: [{
            type: 'SOLID',
            color: {
                r: red / 255,
                g: green / 255,
                b: blue / 255,
                a: alpha,
            },
        }],
    };
}

interface MutableFrame {
    states: Map<string, JsonObject>;
}

/**
 * Строит обезличенную полную раскладку из активных токенов JSON.
 * Режим нужен только для начального создания регрессионного слепка; обычное
 * обновление слепка должно идти через sanitizeFigmaFixture и живой REST.
 */
export function buildNormalizedFigmaFixture(
    palettes: readonly PaletteDefinition[],
    paletteJsons: ReadonlyMap<string, unknown>,
): JsonObject {
    const pages = palettes.map((palette) => {
        const paletteJson = paletteJsons.get(palette.targetJson);
        invariant(isPlainObject(paletteJson), `${palette.targetJson} должен быть JSON-объектом`);
        const sections = new Map<string, Map<string, MutableFrame>>();

        for (const [key, rawToken] of Object.entries(paletteJson)) {
            invariant(isPlainObject(rawToken), `${palette.targetJson}: токен ${key} должен быть объектом`);
            if (rawToken.deprecated === true) continue;
            invariant(typeof rawToken.figma === 'string', `${palette.targetJson}: у ${key} нет figma`);
            const context = resolveIdentityContext(palette, key, rawToken.figma);
            validateCanonicalToken(rawToken, { key, figma: rawToken.figma });
            const token = rawToken as CanonicalColorToken;
            const frames = sections.get(context.sectionName) ?? new Map<string, MutableFrame>();
            sections.set(context.sectionName, frames);
            const frame = frames.get(context.frameName) ?? { states: new Map<string, JsonObject>() };
            frames.set(context.frameName, frame);
            invariant(!frame.states.has(context.stateName), `${key}: состояние в раскладке повторяется`);
            frame.states.set(context.stateName, rectangleFromToken(token, context.stateName));
        }

        return {
            type: 'CANVAS',
            name: palette.figma.pageName,
            children: [...sections.entries()]
                .sort(([left], [right]) => compareCodeUnits(left, right))
                .map(([sectionName, frames]) => ({
                    type: 'SECTION',
                    name: sectionName,
                    children: [...frames.entries()]
                        .sort(([left], [right]) => compareCodeUnits(left, right))
                        .map(([frameName, frame]) => {
                            const children: JsonObject[] = [];
                            for (const stateName of palette.stateNames) {
                                const rectangle = frame.states.get(stateName);
                                if (rectangle !== undefined) children.push(rectangle);
                            }
                            return { type: 'FRAME', name: frameName, children };
                        }),
                })),
        };
    });

    return { document: { children: pages } };
}
