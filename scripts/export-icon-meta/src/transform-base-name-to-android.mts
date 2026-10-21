/**
 * Преобразуем имя для android платформ glyph_a-scores-circle_m => glyph_a_scores_circle_m
 */
export const transformBaseNameToAndroid = (basename: string) => {
    return basename.replace(/-/g, '_');
};
