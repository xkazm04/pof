import { describe, it, expect } from 'vitest';
import { tuneComboToTargetDps } from '@/lib/combat/combo-tuner';
import type { ComboLike } from '@/lib/combat/combo-analysis';

function combo(over: Partial<ComboLike> = {}): ComboLike {
  return { id: 'cb', name: 'C', weaponCategory: 'Sword', hits: 3, totalTime: '1.5s', dps: 245, chain: ['a', 'b', 'c'], ...over };
}

describe('tuneComboToTargetDps', () => {
  it('proposes a faster retime and a damage scale to raise DPS', () => {
    const p = tuneComboToTargetDps(combo(), 300);
    expect(p.reachable).toBe(true);
    // totalDamage = 245*1.5 = 367.5; retime = 367.5/300 = 1.225
    expect(p.retimeSec).toBeCloseTo(1.225, 2);
    // damage scale = 300/245 = 1.224
    expect(p.damageScale).toBeCloseTo(1.224, 2);
  });

  it('proposes a slower retime and a sub-1 damage scale to lower DPS', () => {
    const p = tuneComboToTargetDps(combo(), 200);
    expect(p.reachable).toBe(true);
    expect(p.retimeSec).toBeGreaterThan(1.5); // slower
    expect(p.damageScale).toBeLessThan(1);
  });

  it('is unreachable for a non-positive target', () => {
    expect(tuneComboToTargetDps(combo(), 0).reachable).toBe(false);
  });

  it('is unreachable when the combo has no parseable duration', () => {
    expect(tuneComboToTargetDps(combo({ totalTime: 'Infinite' }), 300).reachable).toBe(false);
  });
});
