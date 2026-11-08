/**
 * FTS5 snippet() highlight markers shared by the search index (server) and the
 * palette (client). Private-use code points: unlike the printable arrows they
 * replaced, they cannot occur in indexed titles or bodies, so a literal arrow
 * in a title is never mistaken for a highlight boundary.
 */
export const HIGHLIGHT_OPEN = '\uE000';
export const HIGHLIGHT_CLOSE = '\uE001';

/** Remove highlight markers, keeping every real character of the text. */
export function stripHighlightMarkers(text: string): string {
  return text.split(HIGHLIGHT_OPEN).join('').split(HIGHLIGHT_CLOSE).join('');
}
