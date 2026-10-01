/**
 * The changes digest leads with what STOPPED PASSING — classified only from the verdict the
 * store archived (`priorStatus`), never guessed — and hands those rows to the work queue at
 * each entity's OWN step index.
 */
import { describe, it, expect } from 'vitest';
import {
  verdictShift, rankChanges, describeChanges, regressionQueue, describeShift,
  type CatalogChangeRow, type CatalogChanges,
} from '@/components/layout-lab/labCatalogChanges';

const row = (over: Partial<CatalogChangeRow> = {}): CatalogChangeRow => ({
  entityId: 'e1', step: 'StepA', status: 'pass', updatedAt: '2026-09-30T12:00:00.000Z',
  revisionsSince: 1, historyTruncated: false, ...over,
});

const changes = (rows: CatalogChangeRow[]): CatalogChanges =>
  ({ catalogId: 'items', since: '2026-09-29T09:00:00.000Z', cap: 20, rows, truncated: 0 });

describe('verdictShift — only from the archived verdict', () => {
  it('pass -> fail is regressed', () => {
    expect(verdictShift({ priorStatus: 'pass', status: 'fail' })).toBe('regressed');
  });
  it('deferred -> pass is improved', () => {
    expect(verdictShift({ priorStatus: 'deferred', status: 'pass' })).toBe('improved');
  });
  it('pass -> pass is same', () => {
    expect(verdictShift({ priorStatus: 'pass', status: 'pass' })).toBe('same');
  });
  it('no archived verdict is unknown — never assumed', () => {
    expect(verdictShift({ status: 'fail' })).toBe('unknown');
  });
  it('fail -> pending is sideways (neither passed)', () => {
    expect(verdictShift({ priorStatus: 'fail', status: 'pending' })).toBe('sideways');
  });
});

describe('rankChanges', () => {
  it('regressed first, then improved, then same/sideways, then unknown; newest first within a class', () => {
    const newestUnknown = row({ entityId: 'u', updatedAt: '2026-09-30T23:00:00.000Z' });
    const olderRegressed = row({ entityId: 'r', priorStatus: 'pass', status: 'fail', updatedAt: '2026-09-30T01:00:00.000Z' });
    const newestImproved = row({ entityId: 'i', priorStatus: 'fail', status: 'pass', updatedAt: '2026-09-30T22:00:00.000Z' });
    const same = row({ entityId: 's', priorStatus: 'pass', status: 'pass', updatedAt: '2026-09-30T02:00:00.000Z' });
    const sideways = row({ entityId: 'w', priorStatus: 'fail', status: 'pending', updatedAt: '2026-09-30T03:00:00.000Z' });
    const newerRegressed = row({ entityId: 'r2', priorStatus: 'pass', status: 'pending', updatedAt: '2026-09-30T05:00:00.000Z' });
    const ranked = rankChanges([newestUnknown, olderRegressed, newestImproved, same, sideways, newerRegressed]);
    expect(ranked.map((r) => r.entityId)).toEqual(['r2', 'r', 'i', 'w', 's', 'u']);
  });
  it('does not mutate its input', () => {
    const input = [row({ entityId: 'u' }), row({ entityId: 'r', priorStatus: 'pass', status: 'fail' })];
    rankChanges(input);
    expect(input.map((r) => r.entityId)).toEqual(['u', 'r']);
  });
});

describe('describeChanges — the headline counts what stopped passing', () => {
  it('2 regressed + 1 improved + 5 unknown', () => {
    const rows = [
      row({ entityId: 'a', priorStatus: 'pass', status: 'fail' }),
      row({ entityId: 'b', priorStatus: 'pass', status: 'pending' }),
      row({ entityId: 'c', priorStatus: 'fail', status: 'pass' }),
      ...['d', 'e', 'f', 'g', 'h'].map((id) => row({ entityId: id, status: 'fail', revisionsSince: 0 })),
    ];
    const text = describeChanges(changes(rows));
    expect(text).toContain('2 stopped passing');
    expect(text).toContain('1 now passes');
    expect(text).toContain('8 steps moved');
  });
  it('says nothing about shifts it has no evidence for', () => {
    const text = describeChanges(changes([row({ revisionsSince: 0 })]));
    expect(text).toContain('1 step moved');
    expect(text).not.toContain('stopped passing');
    expect(text).not.toContain('now pass');
  });
});

describe('describeShift — words + glyph, never hue alone', () => {
  it('names what the step WAS and IS', () => {
    const s = describeShift(row({ priorStatus: 'pass', status: 'fail' }));
    expect(s.text).toContain('was pass');
    expect(s.text).toContain('now fail');
    expect(s.glyph).not.toBe('');
  });
  it('an unknown prior says the verdict before is not on record', () => {
    expect(describeShift(row({ status: 'fail' })).text).toContain('not on record');
  });
});

describe('regressionQueue', () => {
  it('queues only the regressed rows, each at its entity OWN step index; skips a step the entity lacks', () => {
    const rows = [
      row({ entityId: 'good', step: 'Accessibility', status: 'pass', priorStatus: 'pass' }),
      row({ entityId: 'd1', step: 'Subtitles & Choices UI', priorStatus: 'pass', status: 'pending', updatedAt: '2026-09-30T10:00:00.000Z' }),
      row({ entityId: 'pof', step: 'Test Gate', priorStatus: 'pass', status: 'fail', updatedAt: '2026-09-30T11:00:00.000Z' }),
      row({ entityId: 'd1', step: 'Retired', priorStatus: 'pass', status: 'fail' }),
      row({ entityId: 'u', step: 'Test Gate', status: 'fail' }),
    ];
    const own: Record<string, string[]> = {
      d1: ['A', 'B', 'C', 'D', 'Subtitles & Choices UI', 'Accessibility'],
      pof: ['A', 'Test Gate'],
    };
    const stepIndexOf = (e: string, s: string) => (own[e] ?? []).indexOf(s);
    const nameOf = (e: string) => (e === 'd1' ? 'Town Story' : undefined);
    const q = regressionQueue(changes(rows), stepIndexOf, nameOf);
    expect(q.catalogId).toBe('items');
    expect(q.label).toContain('stopped passing');
    expect(q.cursor).toBe(0);
    expect(q.items).toEqual([
      { entityId: 'pof', entityName: 'pof', step: 'Test Gate', stepIndex: 1 },
      { entityId: 'd1', entityName: 'Town Story', step: 'Subtitles & Choices UI', stepIndex: 4 },
    ]);
  });
});
