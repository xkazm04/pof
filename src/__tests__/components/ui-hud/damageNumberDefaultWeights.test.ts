import { describe, it, expect } from 'vitest';
import { DEFAULT_COMBAT } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';

describe('DEFAULT_COMBAT element weights', () => {
  it('carry only the four damage elements; heals come from healPercent (default 0)', () => {
    expect(Object.keys(DEFAULT_COMBAT.elementWeights).sort()).toEqual(['fire', 'ice', 'lightning', 'physical']);
    expect(DEFAULT_COMBAT.healPercent).toBe(0);
  });
});
