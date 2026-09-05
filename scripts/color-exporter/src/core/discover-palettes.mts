import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { assertExactKeys, invariant, isPlainObject } from './assertions.mjs';
import { compareCodeUnits } from './stable-order.mjs';
import type { PaletteDefinition } from './types.mjs';

const PALETTE_FIELDS = [
    'id',
    'description',
    'figma',
    'targetJson',
    'stateNames',
    'validateSectionName',
    'validateFrameName',
    'validateFrameComposition',
    'deriveIdentity',
    'makeToken',
] as const;

function validateTargetPath(targetJson: string): void {
    invariant(typeof targetJson === 'string' && targetJson.length > 0, 'targetJson должен быть непустой строкой');
    invariant(!path.isAbsolute(targetJson), `targetJson ${targetJson} должен быть относительным`);
    invariant(!targetJson.includes('\\'), `targetJson ${targetJson} должен использовать прямые слеши`);
    invariant(!targetJson.split('/').includes('..'), `targetJson ${targetJson} не должен выходить из репозитория`);
    invariant(path.posix.normalize(targetJson) === targetJson, `targetJson ${targetJson} должен быть нормализован`);
}

function validatePalette(palette: unknown, fileName: string): asserts palette is PaletteDefinition {
    invariant(isPlainObject(palette), `${fileName} должен экспортировать объект по умолчанию`);
    const actualFields = Object.keys(palette);
    invariant(
        actualFields.length === PALETTE_FIELDS.length
            && PALETTE_FIELDS.every((field) => Object.hasOwn(palette, field)),
        `${fileName}: определение палитры: ожидались поля ${PALETTE_FIELDS.join(', ')}, получены ${actualFields.join(', ')}`,
    );
    invariant(typeof palette.id === 'string' && /^[a-z0-9-]+$/.test(palette.id), `${fileName}: id должен содержать строчные латинские буквы, цифры и дефисы`);
    invariant(typeof palette.description === 'string' && palette.description.length > 0, `${fileName}: description обязателен`);
    invariant(isPlainObject(palette.figma), `${fileName}: figma должен быть объектом`);
    assertExactKeys(palette.figma, ['pageName'], `${fileName}: настройки Figma`);
    invariant(typeof palette.figma.pageName === 'string' && /^colors_[a-z0-9_]+\.json$/.test(palette.figma.pageName), `${fileName}: figma.pageName имеет недопустимый формат`);
    invariant(typeof palette.targetJson === 'string', `${fileName}: targetJson должен быть строкой`);
    validateTargetPath(palette.targetJson);
    invariant(
        palette.targetJson === `styles/${palette.figma.pageName}`,
        `${fileName}: целевой JSON должен лежать в styles и совпадать с именем страницы Figma`,
    );
    invariant(Array.isArray(palette.stateNames) && palette.stateNames.length > 0, `${fileName}: stateNames должен быть непустым массивом`);
    invariant(palette.stateNames.every((stateName) => typeof stateName === 'string'), `${fileName}: все stateNames должны быть строками`);
    invariant(new Set(palette.stateNames).size === palette.stateNames.length, `${fileName}: stateNames содержит повторы`);
    invariant(
        palette.stateNames.every((stateName) => /^[a-z0-9-]+$/.test(stateName)),
        `${fileName}: stateNames должен содержать только машинные имена`,
    );
    invariant(palette.stateNames.includes('default'), `${fileName}: состояние default обязательно`);

    for (const functionName of PALETTE_FIELDS.slice(5)) {
        invariant(typeof palette[functionName] === 'function', `${fileName}: функция ${functionName} обязательна`);
    }
    invariant(fileName === `${palette.id}.mjs`, `${fileName}: имя файла должно совпадать с id ${palette.id}`);
}

/**
 * Автоматически находит все файлы палитр.
 *
 * Реестра особых модулей нет: добавление файла включает особые правила в
 * результат этой функции, а удаление перестаёт их обнаруживать. Обычные
 * стандартные страницы подключаются во время чтения Figma и исходного
 * модуля не требуют. Имена файлов сортируются, чтобы порядок обработки не
 * зависел от операционной системы.
 */
export async function discoverPalettes(
    directoryUrl: URL = new URL('../palettes/', import.meta.url),
): Promise<PaletteDefinition[]> {
    const directoryEntries = await readdir(directoryUrl, { withFileTypes: true });
    const moduleNames = directoryEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.startsWith('_'))
        .map((entry) => entry.name)
        .sort(compareCodeUnits);
    const importedModules: Array<{ default?: unknown }> = await Promise.all(
        moduleNames.map(async (fileName) => import(new URL(fileName, directoryUrl).href) as Promise<{ default?: unknown }>),
    );
    const palettes = importedModules.map((module, index) => {
        const fileName = moduleNames[index];
        invariant(fileName !== undefined, 'внутренняя ошибка порядка файлов палитр');
        validatePalette(module.default, fileName);
        return module.default;
    });

    const ids = new Set<string>();
    const targetPaths = new Set<string>();
    const figmaPages = new Set<string>();
    for (const palette of palettes) {
        invariant(!ids.has(palette.id), `id палитры ${palette.id} повторяется`);
        invariant(!targetPaths.has(palette.targetJson), `путь ${palette.targetJson} используется несколькими палитрами`);
        invariant(!figmaPages.has(palette.figma.pageName), `страница ${palette.figma.pageName} используется несколькими палитрами`);
        ids.add(palette.id);
        targetPaths.add(palette.targetJson);
        figmaPages.add(palette.figma.pageName);
    }

    return palettes;
}
