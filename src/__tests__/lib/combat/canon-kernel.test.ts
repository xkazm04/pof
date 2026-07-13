import { describe, it, expect } from 'vitest';
import {
  computeHit,
  bucketRaw,
  armourReduction,
  armourEffectiveHpMultiplier,
  CRIT_MULTIPLIER,
  CRIT_CHANCE_CAP,
  RESIST_CAP,
  type Offense,
  type Defense,
} from '@/lib/combat/canon-kernel';

// Reconciliation: worked canon examples (ARPG-LAWS §3–4) computed BY HAND, then
// asserted against the kernel. If the kernel drifts from canon, these fail.

describe('canon kernel — offense stacking (added → increased → more)', () => {
  it('collapses base+added, then one increased multiplier, then each more separately', () => {
    // (100 + 50) × (1 + 50/100) × (1 + 20/100) × (1 + 30/100)
    // = 150 × 1.5 × 1.2 × 1.3 = 351
    const raw = bucketRaw({ base: 100, added: 50, increasedPct: 50, morePcts: [20, 30] });
    expect(raw).toBeCloseTo(351, 6);
  });

  it('sums all "increased" into ONE additive multiplier (30% + 20% = ×1.5)', () => {
    const asSum = bucketRaw({ base: 100, increasedPct: 50 });
    const asTwoIncreases = bucketRaw({ base: 100, increasedPct: 30 + 20 });
    expect(asSum).toBeCloseTo(asTwoIncreases, 6);
    expect(asSum).toBeCloseTo(150, 6);
  });

  it('applies each "more" as its OWN multiplier (×1.3 × ×1.2 ≠ ×1.5)', () => {
    const twoMores = bucketRaw({ base: 100, morePcts: [30, 20] });
    expect(twoMores).toBeCloseTo(100 * 1.3 * 1.2, 6); // 156
    // distinct from a single +50% increased
    expect(twoMores).not.toBeCloseTo(150, 3);
  });
});

describe('canon kernel — crit', () => {
  it('defaults the crit multiplier to canon ×2.5', () => {
    expect(CRIT_MULTIPLIER).toBe(2.5);
    const r = computeHit({ buckets: { Physical: { base: 100 } }, crit: { chance: 1 } }, {}, { forceCrit: true });
    expect(r.isCrit).toBe(true);
    expect(r.total).toBeCloseTo(250, 6);
  });

  it('honours a caller-supplied crit multiplier', () => {
    const r = computeHit({ buckets: { Physical: { base: 100 } }, crit: { chance: 1, multiplier: 1.5 } }, {}, { forceCrit: true });
    expect(r.total).toBeCloseTo(150, 6);
  });

  it('hard-caps crit chance at 95% — a "100%" crit still misses on a 0.96 roll', () => {
    expect(CRIT_CHANCE_CAP).toBe(0.95);
    const miss = computeHit({ buckets: { Physical: { base: 100 } }, crit: { chance: 1 } }, {}, { rng: () => 0.96 });
    expect(miss.isCrit).toBe(false);
    const hit = computeHit({ buckets: { Physical: { base: 100 } }, crit: { chance: 1 } }, {}, { rng: () => 0.5 });
    expect(hit.isCrit).toBe(true);
  });
});

describe('canon kernel — armour mitigation (soft-capped, never flat %)', () => {
  it('reduction = armour / (armour + 5 × rawPhysHit): armour 100 vs a 100 hit ≈ 16.7%', () => {
    // 100 / (100 + 5·100) = 100/600 = 0.1667 → 100 × 0.8333 = 83.33
    const r = computeHit({ buckets: { Physical: { base: 100 } } }, { armour: 100 });
    expect(r.total).toBeCloseTo(83.333, 2);
  });

  it('is weaker against one big hit than against a small hit (soft-cap)', () => {
    const bigHit = armourReduction(200, 1000); // 200/(200+5000)=0.0385
    const smallHit = armourReduction(200, 20);  // 200/(200+100)=0.667
    expect(smallHit).toBeGreaterThan(bigHit);
    expect(bigHit).toBeCloseTo(200 / 5200, 6);
    expect(smallHit).toBeCloseTo(200 / 300, 6);
  });

  it('armourWeight scales armour before the soft-cap', () => {
    const r = computeHit({ buckets: { Physical: { base: 100 } } }, { armour: 100, armourWeight: 2 });
    // eff 200 / (200 + 500) = 0.2857 → 100 × 0.7143 = 71.43
    expect(r.total).toBeCloseTo(71.43, 1);
  });
});

describe('canon kernel — resists (capped at 75%)', () => {
  it('caps per-type resist at 75% even when the input is higher', () => {
    expect(RESIST_CAP).toBe(0.75);
    const r = computeHit({ buckets: { Fire: { base: 100 } } }, { resists: { Fire: 0.9 } });
    expect(r.total).toBeCloseTo(25, 6); // capped to 0.75 → ×0.25
  });

  it('applies an uncapped-but-below-cap resist directly', () => {
    const r = computeHit({ buckets: { Cold: { base: 100 } } }, { resists: { Cold: 0.5 } });
    expect(r.total).toBeCloseTo(50, 6);
  });

  it('honours a raised resist cap (max-res build)', () => {
    const r = computeHit({ buckets: { Fire: { base: 100 } } }, { resists: { Fire: 0.9 }, resistCap: 0.9 });
    expect(r.total).toBeCloseTo(10, 6);
  });

  it('does not apply armour to elemental damage', () => {
    const r = computeHit({ buckets: { Lightning: { base: 100 } } }, { armour: 100000 });
    expect(r.total).toBeCloseTo(100, 6);
  });
});

describe('canon kernel — typed multi-bucket + mitigation order', () => {
  it('mitigates Physical by armour and each element by its own resist, then sums', () => {
    const off: Offense = { buckets: { Physical: { base: 100 }, Fire: { base: 100 } } };
    const def: Defense = { armour: 100, resists: { Fire: 0.5 } };
    const r = computeHit(off, def);
    expect(r.byType.Physical).toBeCloseTo(83.333, 2);
    expect(r.byType.Fire).toBeCloseTo(50, 6);
    expect(r.total).toBeCloseTo(133.333, 2);
  });
});

describe('canon kernel — avoidance layer (evasion → block)', () => {
  it('evasion voids the hit entirely (attacks only)', () => {
    const r = computeHit({ buckets: { Physical: { base: 100 } } }, { evasionChance: 0.5 }, { rng: () => 0.1 });
    expect(r.avoided).toBe('evasion');
    expect(r.total).toBe(0);
  });

  it('a partial block removes its blockAmount fraction', () => {
    const r = computeHit(
      { buckets: { Physical: { base: 100 } } },
      { blockChance: 1, blockAmount: 0.5 },
      { rng: () => 0.9 },
    );
    expect(r.avoided).toBe('block');
    expect(r.total).toBeCloseTo(50, 6);
  });

  it('draws NO rng when no avoidance chance is set (adapters keep rng order)', () => {
    let draws = 0;
    const rng = () => { draws++; return 0.99; };
    // only the crit roll should draw
    computeHit({ buckets: { Physical: { base: 100 } }, crit: { chance: 0.5 } }, {}, { rng });
    expect(draws).toBe(1);
  });
});

describe('canon kernel — derived EHP', () => {
  it('armourEffectiveHpMultiplier = 1 / (1 − reduction) against a reference hit', () => {
    // armour 100 vs 100 hit → reduction 0.1667 → 1/0.8333 = 1.2
    expect(armourEffectiveHpMultiplier(100, 100)).toBeCloseTo(1.2, 3);
    // no armour → no benefit
    expect(armourEffectiveHpMultiplier(0, 100)).toBe(1);
  });
});
