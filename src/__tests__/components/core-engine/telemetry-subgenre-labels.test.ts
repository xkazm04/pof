/**
 * The Telemetry panel's sub-genre chip label must be the template's own label —
 * the same string the suggestion card shows ("Evolve toward <label>"). The helper
 * used to keep its own hand-maintained name table, which drifted.
 */
import { describe, it, expect } from 'vitest';
import { SUB_GENRE_TEMPLATES } from '@/lib/genre-evolution-engine';
import { formatSubGenreName } from '@/components/modules/core-engine/TelemetryEvolution/helpers';
import type { SubGenreId } from '@/types/telemetry';

describe('formatSubGenreName', () => {
  it('equals the template label for every sub-genre template (derived, not a second list)', () => {
    const drift = SUB_GENRE_TEMPLATES
      .filter((t) => formatSubGenreName(t.id) !== t.label)
      .map((t) => `${t.id}: "${formatSubGenreName(t.id)}" vs "${t.label}"`);
    expect(drift).toEqual([]);
  });

  it('falls back to the raw id for an id with no template', () => {
    expect(formatSubGenreName('legacy-genre' as SubGenreId)).toBe('legacy-genre');
  });
});
