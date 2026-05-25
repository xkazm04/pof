import { describe, it, expect } from 'vitest';
import { lintZone, asZone, type ZoneLike } from '@/lib/world/zone-analysis';

function zone(over: Partial<ZoneLike> = {}): ZoneLike {
  return { id: 'z1', displayName: 'Sanctuary', type: 'hub', status: 'active', levelMin: 1, levelMax: 1, connections: ['z2', 'z3'], ...over };
}

const roster: ZoneLike[] = [
  zone(),
  zone({ id: 'z2', displayName: 'Woods', type: 'combat', levelMin: 1, levelMax: 3, connections: ['z4'] }),
  zone({ id: 'z3', displayName: 'Caves', type: 'combat', levelMin: 2, levelMax: 4, connections: [] }),
  zone({ id: 'z4', displayName: 'Deep', type: 'combat', levelMin: 10, levelMax: 12, connections: ['z2'] }),
];

describe('lintZone', () => {
  it('passes a well-connected hub', () => {
    const findings = lintZone(zone(), roster);
    expect(findings.every((f) => f.severity === 'ok')).toBe(true);
  });

  it('errors on an inverted level range', () => {
    const findings = lintZone(zone({ id: 'zx', levelMin: 6, levelMax: 3, type: 'combat', connections: ['z1'] }), roster);
    expect(findings.some((f) => f.severity === 'error' && /level range/i.test(f.message))).toBe(true);
  });

  it('errors on a connection to an unknown zone', () => {
    const findings = lintZone(zone({ id: 'zx', type: 'combat', connections: ['zMissing', 'z1'] }), roster);
    expect(findings.some((f) => f.severity === 'error' && /unknown zone/i.test(f.message))).toBe(true);
  });

  it('warns about a dead-end non-boss zone', () => {
    const findings = lintZone(zone({ id: 'z3', type: 'combat', connections: [] }), roster);
    expect(findings.some((f) => f.severity === 'warn' && /dead.end/i.test(f.message))).toBe(true);
  });

  it('warns about a level-jump difficulty spike to a connected zone', () => {
    // z2 (max 3) → z4 (min 10): gap 7
    const findings = lintZone(roster[1], roster);
    expect(findings.some((f) => f.severity === 'warn' && /spike|levels higher/i.test(f.message))).toBe(true);
  });

  it('warns about an unreachable non-hub zone', () => {
    const orphan = zone({ id: 'z9', type: 'combat', levelMin: 1, levelMax: 2, connections: ['z1'] });
    const findings = lintZone(orphan, [...roster, orphan]);
    expect(findings.some((f) => f.severity === 'warn' && /no zone leads here|unreachable/i.test(f.message))).toBe(true);
  });
});

describe('asZone', () => {
  it('parses a zone-shaped object', () => {
    expect(asZone(zone())).not.toBeNull();
  });
  it('returns null for non-zone data', () => {
    expect(asZone({ id: 'x' })).toBeNull();
    expect(asZone(null)).toBeNull();
  });
});
