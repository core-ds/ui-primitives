import { invariant } from '../core/assertions.mjs';
import type {
    CanonicalColorToken,
    CanonicalTokenInput,
    FrameCompositionContext,
    IdentityContext,
    PaletteDefinition,
    PaletteIdentity,
} from '../core/types.mjs';

export const INTERACTIVE_STATES = Object.freeze(['default', 'hover', 'press'] as const);
export const DEFAULT_ONLY = Object.freeze(['default'] as const);
export const SIMPLE_FRAME_NAME = /^[a-z0-9-]+$/;

const FIGMA_VARIABLE_MODE = /^(light|dark)\/(.+)$/;
const TOKEN_MODE_SECTION = /^static_.+$/;
const VARIABLE_MODE_NAME_PREFIX = /^(?:light|dark)_/;

/**
 * `standard` разбирает режим переменной `light|dark` перед `/` либо режим
 * токена `static_` в имени переменной. `literal` сохраняет всю секцию как путь.
 */
export type SectionPathPolicy = 'standard' | 'literal';

/** Запрещает случайно менять настройки палитры после импорта. */
export function definePalette<T extends PaletteDefinition>(palette: T): Readonly<T> {
    invariant(palette && typeof palette === 'object', 'определение палитры должно быть объектом');
    invariant(palette.figma && typeof palette.figma === 'object', 'у палитры нет настроек Figma');
    invariant(Array.isArray(palette.stateNames), 'у палитры нет списка состояний');

    return Object.freeze({
        ...palette,
        figma: Object.freeze({ ...palette.figma }),
        stateNames: Object.freeze([...palette.stateNames]),
    }) as Readonly<T>;
}

function words(value: string): string[] {
    return value.split(/[-_]+/).filter(Boolean);
}

function upperFirst(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function pascalCase(value: string): string {
    return words(value).map(upperFirst).join('');
}

function camelCase(value: string): string {
    const [first = '', ...rest] = words(value);
    return `${first}${rest.map(upperFirst).join('')}`;
}

function normalizeKeyPart(value: string): string {
    return value.replaceAll('/', '_').replaceAll('-', '_');
}

/**
 * Стандартное правило не позволяет одновременно указать режим переменной
 * перед `/` и режим токена в имени переменной.
 */
export interface SectionIdentityOptions extends IdentityContext {
    sectionPattern: RegExp;
    frameNamePattern?: RegExp;
    stateNames: readonly string[];
    paletteName: string;
    sectionPathPolicy?: SectionPathPolicy;
}

interface ParsedSectionName {
    keyPathWithoutInverted: string;
    figmaFamily: string;
    inverted: boolean;
    mode: string;
}

interface SectionContractOptions {
    sectionName: string;
    sectionPattern: RegExp;
    paletteName: string;
    sectionPathPolicy?: SectionPathPolicy;
}

function parseSectionName({
    sectionName,
    sectionPattern,
    paletteName,
    sectionPathPolicy = 'standard',
}: SectionContractOptions): ParsedSectionName {
    invariant(sectionPattern.test(sectionName), `недопустимое имя секции ${paletteName}: ${sectionName}`);

    let keyPath = sectionName;
    let figmaFamily = sectionName;
    // Статические токены, включая буквальный путь стиля X5, имеют свою
    // область имён. Ядро получает режим явно и не угадывает его по ключу.
    let tokenMode = 'static';
    if (sectionPathPolicy === 'standard') {
        const variableModeSection = FIGMA_VARIABLE_MODE.exec(sectionName);
        if (variableModeSection === null) {
            invariant(
                TOKEN_MODE_SECTION.test(sectionName),
                `секция ${paletteName} должна иметь вид light/<путь>, dark/<путь> или static_<путь>: ${sectionName}`,
            );
        } else {
            const mode = variableModeSection[1];
            const family = variableModeSection[2];
            invariant(mode !== undefined && family !== undefined, `не удалось разобрать секцию ${sectionName}`);
            invariant(
                !family.startsWith('static_'),
                `секция ${paletteName} одновременно содержит режим переменной и режим токена: ${sectionName}`,
            );
            invariant(
                !VARIABLE_MODE_NAME_PREFIX.test(family),
                `путь после режима переменной не должен начинаться с light_ или dark_: ${sectionName}`,
            );
            keyPath = `${mode}/${family}`;
            figmaFamily = family;
            tokenMode = mode;
        }
    }

    invariant(figmaFamily.length > 0, `не удалось определить путь Figma для ${sectionName}`);
    const inverted = figmaFamily.endsWith('_inverted');
    const suffixLength = inverted ? '_inverted'.length : 0;
    const keyPathWithoutInverted = suffixLength === 0 ? keyPath : keyPath.slice(0, -suffixLength);

    return { keyPathWithoutInverted, figmaFamily, inverted, mode: tokenMode };
}

/** Проверяет имя секции тем же правилом, которое затем строит идентификатор. */
export function validateSectionNameContract(options: SectionContractOptions): void {
    parseSectionName(options);
}

/**
 * Строит ключ из полного имени секции. Из пути `figma` удаляет режим
 * переменной `light|dark`, а режим токена `static_` сохраняет.
 */
export function deriveSectionIdentity({
    sectionName,
    frameName,
    stateName,
    sectionPattern,
    frameNamePattern = SIMPLE_FRAME_NAME,
    stateNames,
    paletteName,
    sectionPathPolicy = 'standard',
}: SectionIdentityOptions): PaletteIdentity {
    const parsedSection = parseSectionName({ sectionName, sectionPattern, paletteName, sectionPathPolicy });
    invariant(frameNamePattern.test(frameName), `недопустимое имя фрейма ${paletteName}: ${frameName}`);
    invariant(stateNames.includes(stateName), `недопустимое состояние ${paletteName}: ${stateName}`);

    const keyFamily = normalizeKeyPart(parsedSection.keyPathWithoutInverted);
    const keyToken = normalizeKeyPart(frameName);
    const invertedSuffix = parsedSection.inverted ? '_inverted' : '';
    const stateSuffix = stateName === 'default' ? '' : `_${stateName}`;
    const key = `${keyFamily}_${keyToken}${invertedSuffix}${stateSuffix}`;
    const statePath = stateName === 'default' ? '' : `/${stateName}`;

    return {
        key,
        figma: `${parsedSection.figmaFamily}/${frameName}${statePath}`,
        mode: parsedSection.mode,
    };
}

/**
 * Строит программное поле `alias` из Figma-пути одной формулой для всех наборов.
 *
 * Слово Color ставится прямо перед именем токена. Поэтому пути
 * qualitative-duocolor/set-a/1 и accent_inverted/primary/hover дают
 * qualitativeDuocolorSetAColor1 и accentColorPrimaryInvertedHover.
 */
export function makeAliasFromFigmaPath(figmaPath: string, stateName: string): string {
    invariant(typeof figmaPath === 'string' && figmaPath.length > 0, 'путь Figma должен быть непустой строкой');
    invariant(typeof stateName === 'string' && stateName.length > 0, 'состояние для построения alias обязательно');
    const parts = figmaPath.split('/');
    invariant(parts.every(Boolean), `путь Figma содержит пустую часть: ${figmaPath}`);
    if (stateName !== 'default') {
        invariant(parts.at(-1) === stateName, `путь ${figmaPath} не заканчивается состоянием ${stateName}`);
        parts.pop();
    }

    invariant(parts.length >= 2, `недопустимый путь Figma: ${figmaPath}`);
    const tokenName = parts.pop();
    invariant(tokenName !== undefined, `в пути ${figmaPath} нет имени токена`);
    let inverted = false;
    const familyParts = parts.map((part) => {
        if (!part.endsWith('_inverted')) {
            return part;
        }
        invariant(!inverted, `в пути ${figmaPath} inverted указан несколько раз`);
        inverted = true;
        return part.slice(0, -'_inverted'.length);
    });

    return [
        camelCase(familyParts[0] ?? ''),
        ...familyParts.slice(1).map(pascalCase),
        'Color',
        pascalCase(tokenName),
        inverted ? 'Inverted' : '',
        stateName === 'default' ? '' : pascalCase(stateName),
    ].join('');
}

/** Создаёт пять полей активного токена в единственном допустимом порядке. */
export function makeCanonicalColorToken({ identity, color, stateName }: CanonicalTokenInput): CanonicalColorToken {
    return {
        rgba: color.rgba,
        hex: color.hex,
        figma: identity.figma,
        web: `--color-${identity.key.replaceAll('_', '-')}`,
        alias: makeAliasFromFigmaPath(identity.figma, stateName),
    };
}

/**
 * Проверяет, что после удаления визуальных заглушек остался хотя бы один
 * настоящий токен и каждое его состояние разрешено для этого фрейма.
 */
export function requireAllowedFrameStates({
    sectionName,
    frameName,
    stateNames,
}: FrameCompositionContext, allowedStateNames: readonly string[]): void {
    invariant(stateNames.length > 0, `${sectionName}/${frameName} не содержит ни одного цветового состояния`);
    invariant(
        stateNames.every((stateName) => allowedStateNames.includes(stateName)),
        `${sectionName}/${frameName} допускает состояния ${allowedStateNames.join(', ')}`,
    );
}

/**
 * После полного игнорирования `empty` стандартный фрейм должен содержать
 * непустое подмножество `default`, `hover`, `press`. Взаимный порядок,
 * повторы и неизвестные состояния уже проверены общим парсером.
 */
export function validateStandardFrameComposition(context: FrameCompositionContext): void {
    requireAllowedFrameStates(context, INTERACTIVE_STATES);
}
