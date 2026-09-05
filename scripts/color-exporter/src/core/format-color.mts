import { invariant, isPlainObject } from './assertions.mjs';
import type { FormattedColor, JsonObject } from './types.mjs';

function unitInterval(value: unknown, description: string): number {
    invariant(
        typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1,
        `${description} должен быть числом от 0 до 1`,
    );
    return value;
}

function byteToHex(value: number): string {
    return value.toString(16).padStart(2, '0');
}

function isVariableAlias(value: unknown): boolean {
    return isPlainObject(value)
        && value.type === 'VARIABLE_ALIAS'
        && typeof value.id === 'string'
        && value.id.length > 0;
}

function hasFillStyle(rectangle: JsonObject): boolean {
    if (rectangle.styles === undefined) return false;
    invariant(isPlainObject(rectangle.styles), `у прямоугольника ${rectangle.name} styles должен быть объектом`);
    if (rectangle.styles.fill === undefined) return false;
    invariant(
        typeof rectangle.styles.fill === 'string' && rectangle.styles.fill.length > 0,
        `у прямоугольника ${rectangle.name} идентификатор стиля заливки должен быть непустой строкой`,
    );
    return true;
}

function hasNodeFillVariable(rectangle: JsonObject): boolean {
    if (rectangle.boundVariables === undefined) return false;
    invariant(
        isPlainObject(rectangle.boundVariables),
        `у прямоугольника ${rectangle.name} boundVariables должен быть объектом`,
    );
    const aliases = rectangle.boundVariables.fills;
    if (aliases === undefined) return false;
    invariant(
        Array.isArray(aliases) && aliases.length === 1 && aliases.every(isVariableAlias),
        `у прямоугольника ${rectangle.name} привязка переменной заливки должна содержать один VARIABLE_ALIAS`,
    );
    return true;
}

function hasPaintColorVariable(fill: JsonObject, rectangleName: unknown): boolean {
    if (fill.boundVariables === undefined) return false;
    invariant(
        isPlainObject(fill.boundVariables),
        `у заливки прямоугольника ${rectangleName} boundVariables должен быть объектом`,
    );
    const alias = fill.boundVariables.color;
    if (alias === undefined) return false;
    invariant(
        isVariableAlias(alias),
        `у заливки прямоугольника ${rectangleName} color должен быть VARIABLE_ALIAS`,
    );
    return true;
}

/**
 * Проверяет единственную заливку из переменной или цветового стиля Figma и
 * превращает её в два формата цвета из JSON. Ручной цвет без привязки и
 * любые дополнительные, в том числе скрытые, заливки запрещены.
 *
 * Альфа сначала округляется до двух знаков. Затем именно это округлённое
 * значение используется и в rgba, и в восьмизначном ARGB-hex. Благодаря
 * этому два запуска на одном файле всегда дают одинаковый результат.
 */
export function formatRectangleColor(rectangle: unknown): FormattedColor {
    invariant(isPlainObject(rectangle), 'прямоугольник должен быть объектом');
    invariant(typeof rectangle.name === 'string' && rectangle.name.length > 0, 'у прямоугольника должно быть имя');
    invariant(Array.isArray(rectangle.fills), `у прямоугольника ${rectangle.name} заливки должны быть массивом`);
    const fills = rectangle.fills.map((fill, index): JsonObject => {
        invariant(isPlainObject(fill), `заливка ${index} прямоугольника ${rectangle.name} должна быть объектом`);
        return fill;
    });
    invariant(
        fills.length === 1 && fills[0]?.visible !== false && fills[0]?.type === 'SOLID',
        `прямоугольник ${rectangle.name} должен иметь ровно одну заливку всего; она должна быть видимой и сплошной`,
    );

    const fill = fills[0];
    invariant(fill !== undefined, `у прямоугольника ${rectangle.name} не найдена заливка`);
    const isBoundToVariable = hasNodeFillVariable(rectangle)
        || hasPaintColorVariable(fill, rectangle.name);
    invariant(
        hasFillStyle(rectangle) || isBoundToVariable,
        `заливка прямоугольника ${rectangle.name} должна быть привязана к цветовой переменной или стилю Figma`,
    );
    const color = fill.color;
    invariant(isPlainObject(color), `у прямоугольника ${rectangle.name} нет цвета заливки`);

    const red = Math.round(unitInterval(color.r, 'Красный канал') * 255);
    const green = Math.round(unitInterval(color.g, 'Зелёный канал') * 255);
    const blue = Math.round(unitInterval(color.b, 'Синий канал') * 255);
    const colorAlpha = unitInterval(color.a === undefined ? 1 : color.a, 'Альфа цвета');
    const fillOpacity = unitInterval(fill.opacity === undefined ? 1 : fill.opacity, 'Прозрачность заливки');
    const nodeOpacity = unitInterval(rectangle.opacity === undefined ? 1 : rectangle.opacity, 'Прозрачность прямоугольника');
    const alpha = Number((colorAlpha * fillOpacity * nodeOpacity).toFixed(2));

    const rgbHex = `${byteToHex(red)}${byteToHex(green)}${byteToHex(blue)}`;
    const hex = alpha === 1 ? `#${rgbHex}` : `#${byteToHex(Math.round(alpha * 255))}${rgbHex}`;

    return {
        rgba: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
        hex,
    };
}
