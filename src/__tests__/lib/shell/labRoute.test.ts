import { describe, it, expect } from 'vitest';
import { labHref, parseLabRoute, type LabRoute } from '@/lib/shell/labRoute';
import { parseShellRoute } from '@/lib/shell/shellRoute';

/**
 * scan-sweep --challenge lab-shell-and-navigation/B — the lab's address codec. Legacy modules
 * already had addresses (`/?legacy=1&module=<id>`); no lab location did, so /status could only
 * link to "wherever the lab was last left". A lab address names catalog + entity + step (by
 * LABEL — an index means a different step per canon profile) + view, validated against the
 * closed vocabularies, never trusted.
 */
describe('parseLabRoute — what lab location a URL names', () => {
  it('reads catalog, entity, step label and view', () => {
    expect(parseLabRoute('?legacy=0&c=items&e=item-sword&s=Economy&v=catalogs'))
      .toEqual({ catalogId: 'items', entityId: 'item-sword', step: 'Economy', view: 'catalogs' });
  });

  it('validates: an unknown catalog refuses the whole address, an unknown view is dropped, empty is null', () => {
    expect(parseLabRoute('?c=not-a-catalog&e=x')).toBeNull();
    expect(parseLabRoute('?c=items&v=bogus')).toEqual({ catalogId: 'items' });
    expect(parseLabRoute('')).toBeNull();
  });

  it('labHref round-trips through parseLabRoute and names the lab shell whatever the stored preference', () => {
    const loc: LabRoute = { catalogId: 'items', entityId: 'a b', step: 'Icon 2D Art', view: 'catalogs' };
    const search = new URL(labHref(loc), 'http://x').search;
    expect(parseLabRoute(search)).toEqual(loc);
    // A lab link opens the lab even when the stored shell preference is legacy.
    expect(parseShellRoute(search, 'legacy').shell).toBe('ecw');
  });
});
