import type { SubGenreId } from '@/types/telemetry';
import { SUB_GENRE_MAP } from '@/lib/genre-evolution-engine';

export function formatPatternName(pattern: string): string {
  return pattern
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The template's own label — the one string the suggestion card ("Evolve toward
 *  <label>") also uses. Derived from SUB_GENRE_MAP, never a second hand-kept table. */
export function formatSubGenreName(id: SubGenreId): string {
  return SUB_GENRE_MAP.get(id)?.label ?? id;
}
