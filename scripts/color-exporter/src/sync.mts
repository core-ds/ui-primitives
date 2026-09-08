import { object, sorted } from './contract.mjs';
import { pages, parse, rules } from './layout.mjs';
export { fetchFigma } from './transport.mjs';
export { writePlans } from './files.mjs';

export type Plan = { path: string; before: string | undefined; text: string; deprecated: string[] };

/** Все страницы проверяются до записи. Отсутствующие страницы вообще не читаются. */
export async function prepare(source: unknown, loadBaseline: (path: string) => Promise<string | undefined>, palette = 'all'): Promise<Plan[]> {
    const discovered = pages(source);
    const selected = discovered.filter((page) => palette === 'all' || page.name.slice(7, -5).replaceAll('_', '-') === palette);
    if (palette !== 'all' && selected.length === 0) throw new Error(`Нет страницы набора ${palette}`);
    const plans: Plan[] = [];
    for (const page of selected) {
        const path = `styles/${page.name}`;
        try {
            const active = parse(page, await rules(page.name));
            const before = await loadBaseline(path);
            const old = object(before === undefined ? {} : JSON.parse(before));
            const deprecated: string[] = [];
            const result: [string, Record<string, unknown>][] = sorted(active);
            for (const [key, value] of sorted(Object.entries(old))) {
                const token = object(value);
                if (active.has(key)) continue;
                const { deprecated: flag, ...fields } = token;
                result.push([key, flag === true ? token : { ...fields, deprecated: true }]);
                if (flag !== true) deprecated.push(key);
            }
            plans.push({ path, before, text: `${JSON.stringify(Object.fromEntries(result), null, '\t')}\n`, deprecated });
        } catch (error) {
            throw new Error(`${path}: ${(error as Error).message}`);
        }
    }
    return plans;
}
