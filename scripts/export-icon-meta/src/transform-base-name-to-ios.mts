/**
 * Преобразуем имя для android платформ glyph_a-scores-circle_m => glyph_aScoresCircle_m
 */
export const transformBaseNameToIos = (basename: string) => {
    const regexp = /-(\w)/g;
    return basename.replace(regexp, (_, letter) => letter.toUpperCase());
};
