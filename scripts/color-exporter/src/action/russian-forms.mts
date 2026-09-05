export type RussianForms = readonly [one: string, few: string, many: string];

function pluralForm(number: number, [one, few, many]: RussianForms): string {
    const lastTwoDigits = number % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many;
    const lastDigit = number % 10;
    if (lastDigit === 1) return one;
    if (lastDigit >= 2 && lastDigit <= 4) return few;
    return many;
}

/** Добавляет к числу правильную русскую форму из трёх вариантов. */
export function countWithRussianForm(number: number, forms: RussianForms): string {
    return `${number} ${pluralForm(number, forms)}`;
}
