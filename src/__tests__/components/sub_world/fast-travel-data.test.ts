import { describe, it, expect } from 'vitest';
import { FAST_TRAVEL_COVERAGE, FAST_TRAVEL_NODES } from '@/components/modules/core-engine/sub_world/_shared/data';

describe('fast travel data', () => {
  it('reports coverage only for zones that have a travel node', () => {
    const withNode = new Set(FAST_TRAVEL_NODES.map((n) => n.zone));
    expect(FAST_TRAVEL_COVERAGE.length).toBeGreaterThan(0);
    for (const c of FAST_TRAVEL_COVERAGE) expect(withNode.has(c.zone), c.zone).toBe(true);
  });
  it('every route exists in both directions at the same time', () => {
    const byName = new Map(FAST_TRAVEL_NODES.map((n) => [n.name, n]));
    for (const a of FAST_TRAVEL_NODES) {
      for (const t of a.travelTimes) {
        const back = byName.get(t.to)?.travelTimes.find((x) => x.to === a.name);
        expect(back?.seconds, `${t.to} -> ${a.name}`).toBe(t.seconds);
      }
    }
  });
});
