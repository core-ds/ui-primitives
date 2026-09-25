import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

export const paint = { type: 'SOLID', color: { r: 239 / 255, g: 49 / 255, b: 36 / 255, a: 1 } };
export const rectangle = (name = 'default', fields = {}) => ({ type: 'RECTANGLE', name, styles: { fill: 'style:1' }, fills: [paint], ...fields });
export const frame = (name = 'primary', children: unknown[] = [rectangle()]) => ({ type: 'FRAME', name, children });
export const section = (name = 'light/accent', children: unknown[] = [frame()]) => ({ type: 'SECTION', name, children });
export const page = (name = 'colors_example.json', children: unknown[] = [section()]) => ({ type: 'CANVAS', name, children });
export const document = (...children: unknown[]) => ({ document: { children } });

/** У каждой проверки своя рабочая папка; рядом можно создать локальный Git-сервер. */
export async function temporary(t: TestContext): Promise<string> {
    const parent = await mkdtemp(join(tmpdir(), 'color-test-'));
    t.after(() => rm(parent, { recursive: true, force: true }));
    const root = join(parent, 'work');
    await mkdir(join(root, 'styles'), { recursive: true });
    return root;
}
