import { describe, it, expect } from 'vitest';
import {
  buildWorkQueue,
  queueSummary,
  cellMatches,
  cellRoute,
  parseStatusSearch,
  serializeStatusSearch,
} from '@/lib/status/workQueue';
import { routeOf, summarizeRoutes } from '@/lib/status/readinessRoute';
import { readinessOf } from '@/lib/status/readiness';
import type { StepCell, Swimlane } from '@/lib/status/statusModel';

type G = StepCell['grade'];
const cell = (label: string, engine: string, grade: G, judge?: StepCell['judge']): StepCell => ({
  label,
  engine,
  grade,
  judge,
  counts: { pass: 0, deferred: 0, fail: 0, pending: 0 },
});
const lane = (catalogId: string, readyPct: number, cells: StepCell[]): Swimlane => ({
  catalogId,
  label: catalogId,
  cells,
  readyPct,
  crediblePct: 0,
  startedPct: 0,
  blockedCount: 0,
});

describe('buildWorkQueue', () => {
  it('omits every cell at R3 or above that is reached', () => {
    const l = lane('a', 100, [cell('s1', 'Claude', 'verified'), cell('s2', 'Claude', 'trusted')]);
    expect(buildWorkQueue([l])).toEqual([]);
  });

  it('routes every item with routeOf and nothing else', () => {
    const l = lane('a', 10, [
      cell('t', 'Claude', 'unwired', 'llm-panel'),
      cell('o', 'UE Python', 'unwired', 'ue-test'),
      cell('m', 'Leonardo (Lucid Origin)', 'unwired', 'vlm'),
    ]);
    const items = buildWorkQueue([l]);
    expect(items).toHaveLength(3);
    for (const it of items) {
      const c = l.cells.find((x) => x.label === it.step)!;
      const r = readinessOf(c);
      expect(it.route).toBe(routeOf({ engine: c.engine, judge: c.judge, level: r.level, state: r.state }));
      expect(it.catalogId).toBe('a');
    }
  });

  it('orders blocked, then waiting, then reached; ties by lane readyPct, level, id', () => {
    const lo = lane('lo', 10, [
      cell('reached', 'Claude', 'pending', 'llm-panel'),
      cell('blocked', 'Claude', 'attention', 'llm-panel'),
      cell('waiting', 'Claude', 'deferred', 'llm-panel'),
    ]);
    const hi = lane('hi', 60, [cell('reached', 'Claude', 'pending', 'llm-panel')]);
    const items = buildWorkQueue([lo, hi]);
    expect(items.map((i) => `${i.catalogId}/${i.step}`)).toEqual([
      'lo/blocked',
      'lo/waiting',
      'hi/reached',
      'lo/reached',
    ]);
  });

  it('parks model-blocked items last regardless of state', () => {
    const l = lane('a', 10, [
      cell('img-blocked', 'Leonardo (Lucid Origin)', 'attention', 'vlm'),
      cell('text-reached', 'Claude', 'pending', 'llm-panel'),
      cell('gate-reached', 'UE Python', 'pending', 'ue-test'),
    ]);
    const items = buildWorkQueue([l]);
    expect(items[items.length - 1].step).toBe('img-blocked');
    expect(items.filter((i) => i.parked).map((i) => i.step)).toEqual(['img-blocked']);
    expect(items.filter((i) => i.route !== 'model-blocked').every((i) => !i.parked)).toBe(true);
  });

  it('contributes nothing when there are no lanes (a failed read never invents work)', () => {
    expect(buildWorkQueue([])).toEqual([]);
    expect(buildWorkQueue(null)).toEqual([]);
  });
});

describe('queueSummary and cellMatches', () => {
  const lanes = [
    lane('a', 10, [
      cell('t', 'Claude', 'unwired', 'llm-panel'),
      cell('o', 'UE Python', 'unwired', 'ue-test'),
      cell('m', 'Leonardo (Lucid Origin)', 'unwired', 'vlm'),
      cell('done', 'Claude', 'verified', 'llm-panel'),
    ]),
  ];

  it('equals summarizeRoutes over every cell, at-r3 included', () => {
    const rows = lanes.flatMap((l) => l.cells.map((c) => ({ route: cellRoute(c) })));
    expect(queueSummary(lanes)).toEqual(summarizeRoutes(rows));
    expect(queueSummary(lanes)['at-r3']).toBe(1);
  });

  it('per-route counts equal the cells the route highlight keeps', () => {
    const s = queueSummary(lanes);
    for (const value of ['text', 'model-blocked', 'other-gate', 'at-r3'] as const) {
      const kept = lanes[0].cells.filter((c) => cellMatches(c, { kind: 'route', value })).length;
      expect(s[value]).toBe(kept);
    }
  });

  it('route text matches only text cells; at-r3 only the at-r3 value', () => {
    const [t, o, , done] = lanes[0].cells;
    expect(cellMatches(t, { kind: 'route', value: 'text' })).toBe(true);
    expect(cellMatches(o, { kind: 'route', value: 'text' })).toBe(false);
    expect(cellMatches(done, { kind: 'route', value: 'text' })).toBe(false);
    expect(cellMatches(done, { kind: 'route', value: 'at-r3' })).toBe(true);
    expect(cellMatches(t, { kind: 'route', value: 'at-r3' })).toBe(false);
  });

  it('keeps the existing highlight kinds working', () => {
    const [t] = lanes[0].cells;
    expect(cellMatches(t, null)).toBe(true);
    expect(cellMatches(t, { kind: 'engine', value: 'Claude' })).toBe(true);
    expect(cellMatches(t, { kind: 'engine', value: 'Nope' })).toBe(false);
    expect(cellMatches(t, { kind: 'readiness', value: 'R0' })).toBe(true);
    expect(cellMatches(t, { kind: 'state', value: 'blocked' })).toBe(false);
  });
});

describe('parseStatusSearch / serializeStatusSearch', () => {
  it('reads ?route= and lands on the pipelines tab', () => {
    expect(parseStatusSearch('?route=text')).toMatchObject({ tab: 'pipelines', route: 'text' });
  });
  it('rejects an unknown route', () => {
    expect(parseStatusSearch('?route=bogus').route).toBeNull();
    expect(parseStatusSearch('').route).toBeNull();
  });
  it('composes with the capability class', () => {
    expect(parseStatusSearch('?class=audio&route=other-gate')).toMatchObject({
      tab: 'pipelines',
      filterClass: 'audio',
      route: 'other-gate',
    });
  });
  it('round-trips', () => {
    for (const q of ['', '?route=text', '?class=audio&route=other-gate', '?tab=models', '?catalog=items', '?entity=items:e1', '?tab=pipelines']) {
      const a = parseStatusSearch(q);
      expect(parseStatusSearch(serializeStatusSearch(a))).toEqual(a);
    }
    expect(serializeStatusSearch(parseStatusSearch('?route=text'))).toBe('tab=pipelines&route=text');
  });
});
