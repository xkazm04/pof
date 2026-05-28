import { describe, it, expect } from 'vitest';
import { generateZoneGraph, validateZoneGraph, type ZoneGraphParams } from '@/lib/world/zone-graph-generator';

const base: ZoneGraphParams = {
  zoneCount: 8, branchiness: 0, topology: 'linear', difficulty: 'linear', maxLevel: 30, seed: 1234,
};
const edgeCount = (zs: { connections: string[] }[]) => zs.reduce((a, z) => a + z.connections.length, 0);

describe('generateZoneGraph', () => {
  it('is deterministic for identical params and varies with the seed', () => {
    expect(generateZoneGraph(base)).toEqual(generateZoneGraph(base));
    expect(generateZoneGraph({ ...base, seed: 9999 })).not.toEqual(generateZoneGraph(base));
  });

  it('honors zoneCount (clamped 2..14)', () => {
    expect(generateZoneGraph({ ...base, zoneCount: 6 })).toHaveLength(6);
    expect(generateZoneGraph({ ...base, zoneCount: 1 })).toHaveLength(2);   // clamped up
    expect(generateZoneGraph({ ...base, zoneCount: 99 })).toHaveLength(14); // clamped down
  });

  it('assigns hub first and boss last', () => {
    const zs = generateZoneGraph(base);
    expect(zs[0].type).toBe('hub');
    expect(zs[zs.length - 1].type).toBe('boss');
  });

  it('linear topology connects each non-last zone to exactly the next', () => {
    const zs = generateZoneGraph({ ...base, topology: 'linear' });
    for (let i = 0; i < zs.length - 1; i++) expect(zs[i].connections).toEqual([zs[i + 1].id]);
    expect(zs[zs.length - 1].connections).toEqual([]);
  });

  it('hub-and-spoke connects the hub to every other zone', () => {
    const zs = generateZoneGraph({ ...base, topology: 'hub-and-spoke' });
    const others = zs.slice(1).map((z) => z.id);
    expect([...zs[0].connections].sort()).toEqual([...others].sort());
  });

  it('metroidvania adds more edges as branchiness rises', () => {
    const lo = generateZoneGraph({ ...base, topology: 'metroidvania', branchiness: 0 });
    const hi = generateZoneGraph({ ...base, topology: 'metroidvania', branchiness: 1 });
    expect(edgeCount(hi)).toBeGreaterThan(edgeCount(lo));
  });

  it('produces a monotonic non-inverted difficulty ramp', () => {
    const zs = generateZoneGraph(base);
    for (let i = 0; i < zs.length; i++) {
      expect(zs[i].levelMin).toBeLessThanOrEqual(zs[i].levelMax);
      if (i > 0) expect(zs[i].levelMin).toBeGreaterThanOrEqual(zs[i - 1].levelMin);
    }
  });
});

describe('validateZoneGraph', () => {
  it('reports zero errors for generated graphs across topologies and seeds', () => {
    for (const topology of ['linear', 'hub-and-spoke', 'metroidvania'] as const) {
      for (const seed of [1, 42, 777, 2026]) {
        const res = validateZoneGraph(generateZoneGraph({ ...base, topology, seed }));
        expect(res.errors).toBe(0);
        expect(res.ok).toBe(true);
        expect(res.perZone).toHaveLength(8);
      }
    }
  });
});
