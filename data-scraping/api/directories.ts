/**
 * Handbook entries should assume that the working directory is their own handbook entry folder
 * (i.e. Y where working directory is /${PROJECT_ROOT}/data-scraping/handbooks/X/Y).
 *
 * These variables are mainly intended to be used for easy implementation of future standardised structure extensions.
 * Additionally, using these variables will massively reduce refactoring work required if there are major changes in
 * the future, though hopefully this will not be necessary.
 */
export const dataDir = "data";
export const linksDir = `${dataDir}/links`;
export const proceduresDir = `procedures`;
export const schemaDir = `schema`;
