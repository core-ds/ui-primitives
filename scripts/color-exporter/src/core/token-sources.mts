import { invariant } from './assertions.mjs';
import type { CanonicalColorToken, PaletteIdentity } from './types.mjs';

/** Точное место исходного состояния в раскладке, до преобразования имён. */
export interface TokenSource {
    pageName: string;
    sectionName: string;
    frameName: string;
    stateName: string;
    nodeId?: string;
}

interface RegisteredSource {
    key: string;
    path: string;
}

type SourceIndex = Map<string, RegisteredSource>;

interface ModeIndexes {
    figma: SourceIndex;
    alias: SourceIndex;
}

function describeSource(source: TokenSource): string {
    // Кавычки отделяют уровни дерева, даже когда само имя содержит слеш.
    const path = [source.pageName, source.sectionName, source.frameName, source.stateName]
        .map((part) => JSON.stringify(part))
        .join(' → ');
    return source.nodeId ? `${path} (узел ${JSON.stringify(source.nodeId)})` : path;
}

/**
 * Гарантирует: у каждого экспортируемого имени ровно один источник Figma.
 *
 * Новый экземпляр создаётся для каждой палитры. Ключ и CSS-имя уникальны
 * во всём её JSON; пути Figma и alias — внутри явно переданного режима.
 * Поэтому светлая и тёмная версии могут иметь одинаковый alias, а две
 * светлые версии — нет. Равные rgba и hex не считаются дублями.
 *
 * Проверка выполняется за линейное время по числу токенов. Старый JSON
 * здесь не используется: проверяются только источники текущей раскладки.
 */
export class TokenSourceRegistry {
    private readonly keys: SourceIndex = new Map();
    private readonly web: SourceIndex = new Map();
    private readonly modes = new Map<string, ModeIndexes>();

    register(identity: PaletteIdentity, token: CanonicalColorToken, source: TokenSource): void {
        let mode = this.modes.get(identity.mode);
        if (mode === undefined) {
            mode = { figma: new Map(), alias: new Map() };
            this.modes.set(identity.mode, mode);
        }

        const next = { key: identity.key, path: describeSource(source) };
        const claims = [
            { field: 'key', value: identity.key, index: this.keys },
            { field: 'web', value: token.web, index: this.web },
            { field: 'figma', value: token.figma, index: mode.figma },
            { field: 'alias', value: token.alias, index: mode.alias },
        ];

        // Сначала проверяем все имена. Не оставляем частичную регистрацию,
        // если последнее поле столкнулось с уже зарегистрированным токеном.
        for (const { field, value, index } of claims) {
            const previous = index.get(value);
            if (previous !== undefined) {
                invariant(false,
                    `вычисленное имя ${field} ${JSON.stringify(value)} повторяется; `
                    + `режим нового источника ${JSON.stringify(identity.mode)}. `
                    + `Первый источник: ${previous.path}; ключ ${JSON.stringify(previous.key)}. `
                    + `Второй источник: ${next.path}; ключ ${JSON.stringify(next.key)}`);
            }
        }
        for (const { value, index } of claims) index.set(value, next);
    }
}
