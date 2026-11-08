/**
 * Elite-modifier exclusions resolve and are symmetric (scan-sweep Lane B,
 * card bestiary-archetypes-ai: dangling 'pacified' exclusion).
 *
 * Enraged used to exclude 'pacified', an id no modifier carries, so the
 * conflict UI never fired. Every excludes id must name a real modifier and
 * the relation must hold from both sides.
 */
import { describe, it, expect } from 'vitest';
import { ELITE_MODIFIERS } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

describe('ELITE_MODIFIERS exclusions', () => {
  const ids = new Set(ELITE_MODIFIERS.map((m) => m.id));

  it('every excludes id resolves to a real modifier', () => {
    const dangling = ELITE_MODIFIERS.flatMap((m) =>
      (m.excludes ?? []).filter((ex) => !ids.has(ex)).map((ex) => `${m.id}->${ex}`),
    );
    expect(dangling).toEqual([]);
  });

  it('the relation is symmetric', () => {
    const asymmetric = ELITE_MODIFIERS.flatMap((m) =>
      (m.excludes ?? [])
        .filter((ex) => !ELITE_MODIFIERS.find((o) => o.id === ex)?.excludes?.includes(m.id))
        .map((ex) => `${m.id}->${ex}`),
    );
    expect(asymmetric).toEqual([]);
  });

  it('at least one exclusion exists so the rule is live', () => {
    expect(ELITE_MODIFIERS.some((m) => (m.excludes?.length ?? 0) > 0)).toBe(true);
  });
});
