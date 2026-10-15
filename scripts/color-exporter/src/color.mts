import { object, requireValue } from './contract.mjs';

function unit(value: unknown = 1): number {
    requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'Канал цвета или прозрачность должны быть числом от 0 до 1');
    return value;
}

function alias(value: unknown): boolean {
    const item = object(value);
    requireValue(item.type === 'VARIABLE_ALIAS' && typeof item.id === 'string' && item.id.length, 'Ожидалась привязка VARIABLE_ALIAS');
    return true;
}

/** Берём разрешённый API цвет, но требуем связь с переменной или стилем. */
export function color(node: Record<string, unknown>): { rgba: string; hex: string } {
    requireValue(Array.isArray(node.fills) && node.fills.length === 1, 'Требуется ровно одна заливка, включая скрытые');
    const paint = object(node.fills[0]);
    requireValue(paint.type === 'SOLID' && paint.visible !== false, 'Заливка должна быть видимой и SOLID');
    let bound = false;
    const nodeBinding = node.boundVariables === undefined ? undefined : object(node.boundVariables).fills;
    if (nodeBinding !== undefined) {
        requireValue(Array.isArray(nodeBinding) && nodeBinding.length === 1, 'Требуется одна привязка переменной заливки');
        bound = alias(nodeBinding[0]);
    }
    const paintBinding = paint.boundVariables === undefined ? undefined : object(paint.boundVariables).color;
    if (paintBinding !== undefined) bound = alias(paintBinding);
    const style = node.styles === undefined ? undefined : object(node.styles).fill;
    if (style !== undefined) {
        requireValue(typeof style === 'string' && style.length, 'Пустой идентификатор стиля');
        bound = true;
    }
    requireValue(bound, 'Нужна переменная или стиль Figma, ручной цвет не экспортируется');
    const channels = object(paint.color);
    const rgb = ['r', 'g', 'b'].map((channel) => {
        requireValue(channels[channel] !== undefined, `Нет канала ${channel}`);
        return Math.round(unit(channels[channel]) * 255);
    });
    const alpha = Number((unit(channels.a) * unit(paint.opacity) * unit(node.opacity)).toFixed(2));
    const bytes = alpha === 1 ? rgb : [Math.round(alpha * 255), ...rgb];
    return { rgba: `rgba(${rgb.join(', ')}, ${alpha})`, hex: `#${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}` };
}
