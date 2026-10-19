import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildHome, MAX_ALERTS } from '@/components/layout/GlobalSearchPanel/paletteHome';
import {
  readRecents, recordRecent, RECENTS_CAP, recentsKey,
} from '@/components/layout/GlobalSearchPanel/recentSelections';
import type { SearchResult } from '@/lib/search-index';
import type { ActivityEvent } from '@/stores/activityFeedStore';

function hit(n: number): SearchResult {
  return { id: `cl-arpg-combat-item${n}`, type: 'checklist', moduleId: 'arpg-combat', moduleLabel: 'Combat', title: `Item ${n}`, snippet: '', rank: 0 };
}

function evt(over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'e1', type: 'evaluator-recommendation', timestamp: 1, title: 'Fix combat', description: 'd',
    moduleId: 'arpg-combat', dismissed: false, meta: { prompt: 'do the fix' }, ...over,
  };
}

describe('recentSelections', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('holds the newest 8, newest first', () => {
    for (let i = 0; i < 10; i++) recordRecent('/p', hit(i));
    const list = readRecents('/p');
    expect(list).toHaveLength(RECENTS_CAP);
    expect(RECENTS_CAP).toBe(8);
    expect(list.map((r) => r.id)).toEqual([9, 8, 7, 6, 5, 4, 3, 2].map((n) => hit(n).id));
  });

  it('re-recording an id moves it to the front without duplicating', () => {
    recordRecent('/p', hit(1)); recordRecent('/p', hit(2)); recordRecent('/p', hit(3));
    recordRecent('/p', hit(1));
    expect(readRecents('/p').map((r) => r.id)).toEqual([hit(1).id, hit(3).id, hit(2).id]);
  });

  it('is keyed by project path', () => {
    recordRecent('/a', hit(1));
    expect(readRecents('/b')).toEqual([]);
    expect(readRecents('/a')).toHaveLength(1);
    expect(recentsKey('/a')).not.toBe(recentsKey('/b'));
  });

  it('degrades to an empty list when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(readRecents('/p')).toEqual([]);
    expect(() => recordRecent('/p', hit(1))).not.toThrow();
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem(recentsKey('/p'), '{not json');
    expect(readRecents('/p')).toEqual([]);
    localStorage.setItem(recentsKey('/p'), '{"a":1}');
    expect(readRecents('/p')).toEqual([]);
  });
});

describe('buildHome', () => {
  it('lists recents as kind recent', () => {
    const rows = buildHome({ recents: [hit(1), hit(2)], events: [] });
    expect(rows.map((r) => [r.kind, r.result.id])).toEqual([['recent', hit(1).id], ['recent', hit(2).id]]);
    expect(rows.every((r) => r.run === null)).toBe(true);
  });

  it('turns an undismissed evaluator recommendation with a prompt into an alert with a run intent, before recents', () => {
    const rows = buildHome({ recents: [hit(1)], events: [evt()] });
    expect(rows[0].kind).toBe('alert');
    expect(rows[0].run).toEqual({ kind: 'run', moduleId: 'arpg-combat', prompt: 'do the fix' });
    expect(rows[0].result.title).toBe('Fix combat');
    expect(rows[1].kind).toBe('recent');
  });

  it('excludes dismissed, prompt-less, module-less and other-type events', () => {
    const rows = buildHome({
      recents: [],
      events: [
        evt({ id: 'a', dismissed: true }),
        evt({ id: 'b', meta: {} }),
        evt({ id: 'c', meta: undefined }),
        evt({ id: 'd', moduleId: undefined }),
        evt({ id: 'e', type: 'cli-error' }),
      ],
    });
    expect(rows).toEqual([]);
  });

  it('caps alerts at 3, keeping feed order', () => {
    const events = [1, 2, 3, 4, 5].map((n) => evt({ id: `e${n}`, title: `T${n}` }));
    const rows = buildHome({ recents: [], events });
    expect(MAX_ALERTS).toBe(3);
    expect(rows.map((r) => r.result.title)).toEqual(['T1', 'T2', 'T3']);
  });
});
