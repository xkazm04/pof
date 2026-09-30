/**
 * weekLanded — what landed in a week, read from the dated completion ledger
 * (moduleStore.checklistCompletedAt, adopted from the project_progress row).
 * Undated completions are disclosed, never bucketed; an unmeasured delta is null.
 */
import { describe, it, expect } from 'vitest';
import { MODULE_LABELS } from '@/lib/module-registry';
import { weekLanded, digestWindows } from '@/components/modules/evaluator/WeeklyDigestView/weekLanded';
import { formatDigestMarkdown } from '@/components/modules/evaluator/WeeklyDigestView/helpers';
import type { WeeklyDigest } from '@/types/weekly-digest';

const at = (iso: string) => Date.parse(iso);
const WEEK = { start: at('2026-09-28T00:00:00Z'), end: at('2026-10-05T00:00:00Z') };
const PREV = { start: at('2026-09-21T00:00:00Z'), end: at('2026-09-28T00:00:00Z') };

describe('weekLanded', () => {
  it('lists done items stamped in [start, end), sorted by time, with module + item labels', () => {
    const progress = { 'arpg-character': { 'ac-1': true, 'ac-2': true, 'ac-3': true, 'ac-4': false }, 'arpg-animation': { 'aa-1': true } };
    const ledger = {
      'arpg-character': {
        'ac-1': at('2026-09-30T10:00:00Z'),
        'ac-2': at('2026-10-05T00:00:00Z'), // exactly at end -> excluded
        'ac-3': at('2026-09-20T09:00:00Z'), // before the window
        'ac-4': at('2026-09-29T09:00:00Z'), // stamped but not done -> excluded
      },
      'arpg-animation': { 'aa-1': at('2026-09-28T00:00:00Z') }, // exactly at start -> included
    };
    const r = weekLanded(progress, ledger, WEEK);
    expect(r.items.map((i) => i.itemId)).toEqual(['aa-1', 'ac-1']);
    expect(r.items[0]).toMatchObject({
      moduleId: 'arpg-animation', moduleLabel: MODULE_LABELS['arpg-animation'], label: 'Create AnimInstance C++ class',
    });
    expect(r.items[1]).toMatchObject({
      moduleId: 'arpg-character', moduleLabel: MODULE_LABELS['arpg-character'], label: 'Character foundation package',
      at: at('2026-09-30T10:00:00Z'),
    });
    expect(r.count).toBe(2);
  });

  it('delta = this week - previous week; undated items are counted apart, never bucketed', () => {
    const progress = { 'arpg-character': { 'ac-1': true, 'ac-2': true, 'ac-3': true, 'ac-5': true } };
    const ledger = {
      'arpg-character': {
        'ac-1': at('2026-09-29T10:00:00Z'),
        'ac-2': at('2026-09-30T10:00:00Z'),
        'ac-3': at('2026-09-22T10:00:00Z'),
      },
    };
    const r = weekLanded(progress, ledger, WEEK, PREV);
    expect(r.count).toBe(2);
    expect(r.prevCount).toBe(1);
    expect(r.delta).toBe(1);
    expect(r.undated).toBe(1);
  });

  it('delta is null (not 0) when neither week has a dated stamp but undated completions exist', () => {
    const progress = { 'arpg-character': { 'ac-1': true, 'ac-2': true } };
    const r = weekLanded(progress, {}, WEEK, PREV);
    expect(r.count).toBe(0);
    expect(r.prevCount).toBe(0);
    expect(r.undated).toBe(2);
    expect(r.delta).toBeNull();
  });

  it('doneByEnd for a past window counts only stamps before its end (never today\'s cumulative)', () => {
    const progress = { 'arpg-character': { 'ac-1': true, 'ac-2': true, 'ac-3': true } };
    const ledger = {
      'arpg-character': {
        'ac-1': at('2026-09-10T10:00:00Z'),
        'ac-2': at('2026-09-23T10:00:00Z'),
        'ac-3': at('2026-09-29T10:00:00Z'), // this week: after the viewed week's end
      },
    };
    const r = weekLanded(progress, ledger, PREV);
    expect(r.count).toBe(1);
    expect(r.doneByEnd).toBe(2);
  });
});

describe('digestWindows', () => {
  it('cuts the window and the week before from the digest period in its zone', () => {
    const { window, prevWindow } = digestWindows({ periodStart: '2026-09-28', periodEnd: '2026-10-05', zone: 'UTC' });
    expect(window).toEqual(WEEK);
    expect(prevWindow).toEqual(PREV);
  });
});

describe('formatDigestMarkdown with landed items', () => {
  const digest: WeeklyDigest = {
    periodStart: '2026-09-28', periodEnd: '2026-10-05', zone: 'UTC',
    checklistCompleted: 0, checklistTotal: 100, checklistDelta: 0,
    totalSessions: 3, successRate: 1, totalTimeMs: 60_000,
    mostActiveModule: null, moduleActivity: [], longestStreak: 3, currentStreak: 3,
    achievements: [], dailySessions: [], prevWeekSessions: 1, prevWeekSuccessRate: 1,
  };

  it('with 2 landed items -> a "Landed this week" section naming both', () => {
    const progress = { 'arpg-character': { 'ac-1': true }, 'arpg-animation': { 'aa-1': true } };
    const ledger = { 'arpg-character': { 'ac-1': at('2026-09-29T10:00:00Z') }, 'arpg-animation': { 'aa-1': at('2026-09-30T10:00:00Z') } };
    const md = formatDigestMarkdown(digest, weekLanded(progress, ledger, WEEK, PREV));
    expect(md).toContain('## Landed this week');
    expect(md).toContain('Character foundation package');
    expect(md).toContain('Create AnimInstance C++ class');
  });

  it('with 0 landed -> no such section', () => {
    const md = formatDigestMarkdown(digest, weekLanded({}, {}, WEEK, PREV));
    expect(md).not.toContain('## Landed this week');
  });
});
