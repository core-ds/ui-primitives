/** JSON-объект после проверки входных данных во время выполнения. */
export type JsonObject = Record<string, unknown>;
export type TokenPalette = Record<string, JsonObject>;

/** Минимальный набор свойств узла, который нужен экспортёру. */
export interface FigmaNode extends JsonObject {
    type: string;
    name: string;
}

/** Прямоугольник экспортной раскладки после проверки типа и имени. */
export interface FigmaRectangleNode extends FigmaNode {
    type: 'RECTANGLE';
}

export interface PaletteIdentity extends JsonObject {
    key: string;
    figma: string;
    /** Режим задаёт модуль палитры. Он разделяет области имён, но не записывается в JSON. */
    mode: string;
}

export interface FormattedColor {
    rgba: string;
    hex: string;
}

/** Публичный контракт активного токена. Порядок задаёт код сериализации. */
export interface CanonicalColorToken extends JsonObject {
    rgba: string;
    hex: string;
    figma: string;
    web: string;
    alias: string;
}

export interface IdentityContext {
    sectionName: string;
    frameName: string;
    stateName: string;
}

export interface TokenContext extends IdentityContext {
    identity: PaletteIdentity;
    color: FormattedColor;
}

export interface CanonicalTokenInput {
    identity: PaletteIdentity;
    color: FormattedColor;
    stateName: string;
    sectionName?: string;
    frameName?: string;
}

export interface FrameCompositionContext {
    sectionName: string;
    frameName: string;
    stateNames: string[];
}

/** Независимый модуль одного набора цветов. */
export interface PaletteDefinition {
    readonly id: string;
    readonly description: string;
    readonly figma: Readonly<{
        pageName: string;
    }>;
    readonly targetJson: string;
    readonly stateNames: readonly string[];
    validateSectionName(sectionName: string): void;
    validateFrameName(frameName: string): void;
    validateFrameComposition(context: FrameCompositionContext): void;
    deriveIdentity(context: IdentityContext): PaletteIdentity;
    makeToken(context: CanonicalTokenInput): CanonicalColorToken;
}

export interface LayoutCounts {
    sections: number;
    frames: number;
    rectangles: number;
    placeholders: number;
    tokens: number;
}

export interface ParsedPalette {
    tokens: Map<string, CanonicalColorToken>;
    counts: LayoutCounts;
}

export interface SynchronizationChanges {
    newTokenKeys: string[];
    restoredTokenKeys: string[];
    changedActiveTokenKeys: string[];
    newlyDeprecatedTokenKeys: string[];
}

export interface SynchronizationSummary {
    oldTokens: number;
    resultTokens: number;
    activeTokens: number;
    deprecatedTokens: number;
    newTokens: number;
    restoredTokens: number;
    changedActiveTokens: number;
    newlyDeprecatedTokens: number;
}

export interface SynchronizedPalette {
    palette: TokenPalette;
    changes: SynchronizationChanges;
    summary: SynchronizationSummary;
}

export interface PaletteRunSummary extends LayoutCounts, SynchronizationSummary {}

export interface PaletteRunResult {
    paletteId: string;
    targetJson: string;
    changed: boolean;
    changes: SynchronizationChanges;
    summary: PaletteRunSummary;
}

/** Внутреннее представление файла между фазами расчёта и записи. */
export interface PreparedPaletteRun extends PaletteRunResult {
    targetPath: string;
    oldText?: string;
    nextText: string;
    mode: number;
    writeNeeded: boolean;
}

export interface WritablePreparedFile {
    targetPath: string;
    targetJson: string;
    oldText?: string;
    nextText: string;
    mode: number;
    writeNeeded: boolean;
}

export interface ReadJsonFileResult {
    text: string;
    json: unknown;
    mode: number;
}

/** Узкий ответ Figma REST, чтобы тесты не подделывали весь объект Response. */
export interface FigmaResponseLike {
    ok: boolean;
    status: number;
    headers?: Pick<Headers, 'get'>;
    json(): Promise<unknown>;
}

export type FigmaFetch = (
    input: string,
    init: RequestInit,
) => Promise<FigmaResponseLike>;

export type WaitImplementation = (milliseconds: number) => Promise<void>;

export type PalettePageFactory = (page: { pageName: string }) => Readonly<PaletteDefinition>;

export type BaselineJsonTextLoader = (targetJson: string) => Promise<string | undefined>;

export interface RunPalettesOptions {
    palettes: readonly PaletteDefinition[];
    /** Выбирает один набор после обнаружения стандартных страниц Figma. */
    selectedPaletteId?: string;
    repoRoot: string;
    figmaToken?: string;
    check?: boolean;
    figmaJsonPath?: string | URL;
    fetchImplementation?: FigmaFetch;
    /** Создаёт стандартные правила для страниц без отдельного модуля. */
    createPaletteForPage?: PalettePageFactory;
    /**
     * Исходные JSON из основной ветки. Экшен использует их для отчёта,
     * даже если служебная ветка уже содержит результат прошлого запуска.
     */
    baselineJsonTexts?: ReadonlyMap<string, string | undefined>;
    /** Лениво читает исходный JSON только для найденной страницы Figma. */
    loadBaselineJsonText?: BaselineJsonTextLoader;
}
