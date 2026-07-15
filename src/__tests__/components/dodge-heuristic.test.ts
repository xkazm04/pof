import { describe, it, expect } from 'vitest';
import { computeDodgeHeuristic } from '@/components/modules/core-engine/sub_combat/dodge-timeline/HeaderToolbar';
import { DEFAULT_PARAMS } from '@/components/modules/core-engine/sub_combat/_shared/dodge-types';

describe('computeDodgeHeuristic — local deterministic tuning (no AI/CLI)', () => {
  it('widens the i-frame window +15% and trims cooldown −10%', () => {
    const p = { ...DEFAULT_PARAMS, iFrameDuration: 0.3, dodgeDuration: 1.0, cooldown: 0.8 };
    const r = computeDodgeHeuristic(p);
    expect(r.iFrameDuration).toBeCloseTo(0.345, 5); // 0.3 * 1.15, below the 0.8 cap
    expect(r.cooldown).toBeCloseTo(0.72, 5);        // 0.8 * 0.9
  });

  it('caps the i-frame window at 80% of the dodge duration', () => {
    // 0.75 * 1.15 = 0.8625 would exceed 0.8 * dodgeDuration (0.8) → capped.
    const p = { ...DEFAULT_PARAMS, iFrameDuration: 0.75, dodgeDuration: 1.0 };
    const r = computeDodgeHeuristic(p);
    expect(r.iFrameDuration).toBeCloseTo(0.8, 5);
  });

  it('is pure and deterministic — same input, same output, no param mutation', () => {
    const p = { ...DEFAULT_PARAMS };
    const before = { ...p };
    const a = computeDodgeHeuristic(p);
    const b = computeDodgeHeuristic(p);
    expect(a).toEqual(b);
    expect(p).toEqual(before); // input not mutated
    // Untouched fields carry through unchanged.
    expect(a.dodgeDistance).toBe(p.dodgeDistance);
    expect(a.staminaCost).toBe(p.staminaCost);
  });
});
