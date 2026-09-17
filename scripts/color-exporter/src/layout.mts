import { color } from './color.mjs';
import { object, PAGE, requireValue, type Rule, type Token } from './contract.mjs';

type Node = Record<string, unknown> & { name: string };
const standardSection = /^(?:(?:light|dark)\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*|static_[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)$/;
const slashStaticSection = /^static\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/;

function node(value: unknown, type: string): Node {
    const item = object(value);
    requireValue(item.type === type && typeof item.name === 'string' && item.name.length, `Ожидался именованный ${type}`);
    return item as Node;
}

function children(parent: Node, type: string): Node[] {
    requireValue(Array.isArray(parent.children) && parent.children.length, `${parent.name}: нет дочерних узлов`);
    const result = parent.children.map((value) => node(value, type));
    const names = result.map((item) => item.name);
    if (type !== 'RECTANGLE') requireValue(new Set(names).size === names.length, `${parent.name}: повторяются имена`);
    return result;
}

/** Сначала узнаём страницы из Figma; список файлов репозитория источником не служит. */
export function pages(source: unknown): Node[] {
    const values = object(object(source).document).children;
    requireValue(Array.isArray(values), 'В ответе Figma нет страниц');
    const result = values.filter((value) => {
        const name = value && typeof value === 'object' ? (value as Node).name : undefined;
        return typeof name === 'string' && PAGE.test(name);
    }).map((value) => node(value, 'CANVAS'));
    requireValue(new Set(result.map((item) => item.name)).size === result.length, 'Повторяются экспортные страницы');
    return result.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

export async function rules(pageName: string): Promise<Rule> {
    // Загрузка по проверенному имени: новая стандартная страница не требует регистрации.
    requireValue(PAGE.test(pageName), `Недопустимая страница ${pageName}`);
    const url = new URL(`./palettes/${pageName.slice(7, -5)}.mjs`, import.meta.url);
    const { access } = await import('node:fs/promises');
    try { await access(url); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
        throw error;
    }
    return (await import(url.href)).default as Rule;
}

const pascal = (value: string) => value.split(/[-_]+/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join('');

/** Общая часть имени рассчитывается один раз на секцию, а не для каждого состояния. */
function naming(section: string) {
    const dynamic = /^(light|dark)\/(.+)$/.exec(section);
    const mode = dynamic ? dynamic[1]! : 'static';
    const family = dynamic ? dynamic[2]! : section;
    const inverted = section.endsWith('_inverted');
    const keyFamily = inverted ? section.slice(0, -9) : section;
    const parts = family.split('/');
    const invertedParts = parts.filter((part) => part.endsWith('_inverted'));
    const [first = '', ...rest] = parts.map((part) => part.replace(/_inverted$/, ''));
    const [word = '', ...words] = first.split(/[-_]+/).filter(Boolean);
    const prefix = word + words.map(pascal).join('') + rest.map(pascal).join('') + 'Color';
    return (frame: string, state: string) => {
        requireValue(!dynamic || !/^(static_|light_|dark_)/.test(family), `Несогласованный режим ${section}`);
        requireValue(invertedParts.length <= 1, `${section}: inverted указан несколько раз`);
        const suffix = state === 'default' ? '' : `_${state}`;
        const key = `${keyFamily}_${frame}${inverted ? '_inverted' : ''}${suffix}`.replace(/[/-]/g, '_');
        const figma = `${family}/${frame}${state === 'default' ? '' : `/${state}`}`;
        const alias = prefix + pascal(frame) + (invertedParts.length ? 'Inverted' : '') + (state === 'default' ? '' : pascal(state));
        return { key, figma, alias, mode, web: `--color-${key.replaceAll('_', '-')}` };
    };
}

/** Проверяем дерево один раз и сразу строим окончательные пять полей. */
export function parse(page: Node, rule: Rule): Map<string, Token> {
    const tokens = new Map<string, Token>();
    const sources = new Map<string, string>();
    for (const section of children(page, 'SECTION')) {
        requireValue(standardSection.test(section.name) || (rule.staticSlash && slashStaticSection.test(section.name)), `Недопустимая секция ${section.name}`);
        const identify = naming(section.name);
        for (const frame of children(section, 'FRAME')) {
            requireValue(/^[a-z0-9-]+$/.test(frame.name), `Недопустимый фрейм ${frame.name}`);
            const aliasNames = rule.aliasNames?.(section.name, frame.name);
            const identifyAlias = aliasNames ? naming(aliasNames.section) : undefined;
            let previous = -1;
            for (const rectangle of children(frame, 'RECTANGLE')) {
                if (rectangle.name === 'empty') continue;
                const source = `${page.name}/${section.name}/${frame.name}/${rectangle.name} (${rectangle.id ?? 'без id'})`;
                try {
                    const rank = ['default', 'hover', 'press'].indexOf(rectangle.name);
                    requireValue(rank > previous, 'Недопустимое, повторное или неупорядоченное состояние');
                    previous = rank;
                    const token = identify(frame.name, rectangle.name);
                    if (identifyAlias && aliasNames) token.alias = identifyAlias(aliasNames.frame, rectangle.name).alias;
                    for (const field of ['key', 'web', 'figma', 'alias'] as const) {
                        const scope = field === 'figma' || field === 'alias' ? token.mode : '';
                        const claim = `${field}:${scope}:${token[field]}`;
                        requireValue(!sources.has(claim), `Два источника для ${field} ${token[field]}: ${sources.get(claim)} и ${source}`);
                        sources.set(claim, source);
                    }
                    tokens.set(token.key, { ...color(rectangle), figma: token.figma, web: token.web, alias: token.alias });
                } catch (error) {
                    throw new Error(`${source}: ${(error as Error).message}`);
                }
            }
            requireValue(previous >= 0, `${section.name}/${frame.name}: нет настоящих состояний`);
        }
    }
    return tokens;
}
