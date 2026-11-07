/**
 * The Wave Choreographer's rows name an archetype, a tier and an area by hand. Each must
 * resolve to a real roster entry and agree with it, or a wave points at an enemy the
 * bestiary does not define (measured 2026-11-08: wave 20 named "Dark Marauder", the
 * roster entry is "Dark Side Marauder" - 23 of 24 waves resolved).
 */
import { describe, it, expect } from 'vitest';
import { ARCHETYPES, EXPANDED_WAVES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

describe('EXPANDED_WAVES ↔ ARCHETYPES parity', () => {
  const byLabel = new Map(ARCHETYPES.map(a => [a.label, a]));

  it('every wave archetype resolves to a roster entry', () => {
    const unresolved = EXPANDED_WAVES.filter(w => !byLabel.has(w.archetype)).map(w => `${w.id}:${w.archetype}`);
    expect(unresolved).toEqual([]);
  });

  it('every wave tier and area agree with the roster entry it names', () => {
    const drift = EXPANDED_WAVES.flatMap(w => {
      const a = byLabel.get(w.archetype);
      if (!a) return [];
      const out: string[] = [];
      if (a.tier !== w.tier) out.push(`${w.archetype} tier ${w.tier}≠${a.tier}`);
      if (a.area !== w.area) out.push(`${w.archetype} area ${w.area}≠${a.area}`);
      return out;
    });
    expect(drift).toEqual([]);
  });
});
