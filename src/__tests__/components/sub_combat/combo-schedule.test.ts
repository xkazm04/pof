import { describe, it, expect } from 'vitest';
import { PRESET_COMBOS } from '@/components/modules/core-engine/sub_ability/_shared/data';
import { computeComboStats } from '@/components/modules/core-engine/sub_combat/combos/helpers';
import {
  scheduleCombo, sustainedCycle, rankCombos,
} from '@/components/modules/core-engine/sub_combat/combos/schedule';

// The combo builder's DPS is cooldown-legal and states its basis: a cast starts at
// max(previous end, its own cooldown ready time); burst = one pass, sustained = the
// steady period of the chain looped (scan-sweep --challenge combat-damage-pipeline/B).

const preset = (id: string) => {
  const p = PRESET_COMBOS.find(c => c.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p.abilities;
};

describe('cooldown-legal combo schedule', () => {
  it('a recast waits for its own cooldown; one-pass duration includes the wait', () => {
    const s = scheduleCombo(['dash', 'dash']);
    expect(s.casts[1].start).toBeCloseTo(5.0, 9);
    expect(s.casts[1].waited).toBeCloseTo(4.3, 9);
    expect(s.casts[1].waitedOn).toBe('dash');
    expect(s.casts[0].waited).toBe(0);
    expect(s.casts[0].waitedOn).toBeNull();
    expect(s.totalDuration).toBeCloseTo(5.7, 9);
  });

  it('computeComboStats reports the legal chain, not 63 DPS over 1.4 s', () => {
    const st = computeComboStats(['dash', 'dash']);
    expect(st.totalDamage).toBe(88);
    expect(st.totalDuration).toBeCloseTo(5.7, 9);
    expect(st.dps).toBe(15);
  });

  it('[guard] a cooldown-free chain is unchanged', () => {
    const st = computeComboStats(['melee1', 'melee1', 'melee2']);
    expect(st.totalDamage).toBe(93);
    expect(st.totalMana).toBe(0);
    expect(st.totalDuration).toBeCloseTo(2.1, 9);
    expect(st.maxCooldown).toBe(0);
    expect(st.dps).toBe(44);
  });

  it('Burst DPS preset sustains 37.33, bound by GroundSlam, while burst stays 56', () => {
    const cyc = sustainedCycle(preset('burst'));
    expect(cyc.period).toBeCloseTo(6.0, 9);
    expect(cyc.damagePerCycle).toBeCloseTo(224, 9);
    expect(cyc.sustainedDps).toBeCloseTo(37.33, 2);
    expect(cyc.binding).toBe('slam');
    expect(Math.round(scheduleCombo(preset('burst')).dps)).toBe(56);
  });

  it('Dark Side Burst reads 177 burst but sustains 27.4, bound by Death Field', () => {
    const cyc = sustainedCycle(preset('kotor-dark-side'));
    expect(cyc.period).toBeCloseTo(20, 9);
    expect(cyc.sustainedDps).toBeCloseTo(27.4, 2);
    expect(cyc.binding).toBe('death-field');
    expect(Math.round(scheduleCombo(preset('kotor-dark-side')).dps)).toBe(177);
  });

  it('a chain with no cooldowns loops at its one-pass duration and burst equals sustained', () => {
    const chain = ['melee1', 'melee2'];
    const cyc = sustainedCycle(chain);
    const pass = scheduleCombo(chain);
    expect(cyc.period).toBeCloseTo(1.5, 9);
    expect(cyc.period).toBeCloseTo(pass.totalDuration, 9);
    expect(cyc.sustainedDps).toBeCloseTo(pass.dps, 9);
    expect(cyc.binding).toBeNull();
  });

  it('rankCombos orders the presets differently on each basis', () => {
    const sustained = rankCombos(PRESET_COMBOS, 'sustained');
    expect(sustained.map(r => r.id)).toEqual([
      'basic', 'burst', 'kotor-force-chain', 'kotor-dark-side', 'dash-combo', 'spell-weave',
    ]);
    const expected = [44.05, 37.33, 35, 27.4, 24.17, 6.06];
    sustained.forEach((r, i) => expect(r.sustainedDps).toBeCloseTo(expected[i], 2));
    expect(rankCombos(PRESET_COMBOS, 'burst').map(r => r.id)).toEqual([
      'kotor-dark-side', 'kotor-force-chain', 'burst', 'dash-combo', 'basic', 'spell-weave',
    ]);
  });
});
