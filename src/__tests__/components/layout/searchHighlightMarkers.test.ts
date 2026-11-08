import { describe, it, expect, beforeEach } from 'vitest';
import { highlightMarkers } from '@/components/layout/GlobalSearchPanel/helpers';
import { readRecents, recordRecent } from '@/components/layout/GlobalSearchPanel/recentSelections';
import { HIGHLIGHT_OPEN, HIGHLIGHT_CLOSE } from '@/lib/search-markers';
import type { SearchResult } from '@/lib/search-index';

beforeEach(() => localStorage.clear());

describe('FTS highlight markers vs literal arrows', () => {
  it('a title with a literal arrow produces no mark tag and keeps the arrow', () => {
    const html = highlightMarkers('Idle → Run transition');
    expect(html).not.toContain('<mark');
    expect(html).toContain('Idle → Run transition');
  });

  it('real hits are wrapped, and a literal arrow beside them is untouched', () => {
    const html = highlightMarkers(`${HIGHLIGHT_OPEN}Combo${HIGHLIGHT_CLOSE} → Finisher`);
    expect(html.match(/<mark/g)?.length).toBe(1);
    expect(html).toContain('</mark> → Finisher');
  });

  it('recents drop the markers but keep a literal arrow in the title', () => {
    const hit: SearchResult = {
      id: 'f1', type: 'feature', moduleId: 'arpg-combat', moduleLabel: 'Combat',
      title: `${HIGHLIGHT_OPEN}Idle${HIGHLIGHT_CLOSE} → Run`, snippet: '', rank: -1,
    };
    recordRecent('/p', hit);
    expect(readRecents('/p')[0].title).toBe('Idle → Run');
  });
});
