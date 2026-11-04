/** Static package asset resolution, correct in both src/*.js and flattened lib/*.js builds. */
export const assetUrl = relative => new URL(relative, new URL('../assets/', import.meta.url))
