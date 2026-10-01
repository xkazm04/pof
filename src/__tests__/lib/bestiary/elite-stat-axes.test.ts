/**
 * One stat-axis map for elite modifiers (scan-sweep --challenge, card
 * bestiary-archetypes-ai/A).
 *
 * Elite modifiers speak HP/Damage/Speed/Range; 90 of the 94 archetypes they
 * apply to speak HP/ATK/DEF/SPD/INT. Matching a modifier to a stat by its LABEL
 * silently dropped 990 of 1692 statMod applications. These cases pin the axis
 * match, the un-clamped effective value, and the inert report that names every
 * statMod an archetype has no axis for.
 */
import { describe, it, expect } from 'vitest';
import {
  ARCHETYPES,
  ELITE_MODIFIERS,
  applyModifiers,
  type EliteModifier,
} from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { statAxisOf, inertStatMods } from '@/lib/bestiary/elite-stat-axes';

const mod = (id: string): EliteModifier => {
  const m = ELITE_MODIFIERS.find((x) => x.id === id);
  if (!m) throw new Error(`no elite modifier ${id}`);
  return m;
};
const rakghoul = () => {
  const a = ARCHETYPES.find((x) => x.id === 'rakghoul');
  if (!a) throw new Error('no rakghoul archetype');
  return a;
};

describe('statAxisOf — both stat vocabularies land on one axis', () => {
  it('maps ATK/Damage, SPD/Speed and DEF to their axes, and an unmapped label to null', () => {
    expect(statAxisOf('ATK')).toBe('damage');
    expect(statAxisOf('Damage')).toBe('damage');
    expect(statAxisOf('SPD')).toBe('speed');
    expect(statAxisOf('Speed')).toBe('speed');
    expect(statAxisOf('DEF')).toBe('defense');
    expect(statAxisOf('Mana')).toBeNull();
  });
});

describe('applyModifiers — a statMod applies to the stat on its axis', () => {
  it('Enraged (+50% Damage) moves a 25 ATK to 38', () => {
    expect(applyModifiers(25, 'ATK', [mod('enraged')])).toBe(38);
  });

  it('Swift (+50% Speed) moves a 65 SPD to 98', () => {
    expect(applyModifiers(65, 'SPD', [mod('swift')])).toBe(98);
  });

  it('does not saturate at 100: Commander (+25% Damage) on a 100 Damage reads 125', () => {
    expect(applyModifiers(100, 'Damage', [mod('commander')])).toBe(125);
  });

  it('[guard] the HP path is unchanged', () => {
    expect(applyModifiers(20, 'HP', [mod('enraged')])).toBe(16);
    expect(applyModifiers(50, 'HP', [mod('shielded')])).toBe(80);
  });
});

describe('inertStatMods — every statMod either applies or is reported inert', () => {
  it('reports Arcane\'s Range mod as inert on Rakghoul, and nothing for Enraged', () => {
    expect(inertStatMods(mod('arcane'), rakghoul())).toEqual(['+30% Range']);
    expect(inertStatMods(mod('enraged'), rakghoul())).toEqual([]);
  });

  it('leaves 0 statMods across ARCHETYPES x ELITE_MODIFIERS that neither apply nor are reported inert', () => {
    let silent = 0;
    let total = 0;
    for (const arch of ARCHETYPES) {
      for (const m of ELITE_MODIFIERS) {
        const inert = inertStatMods(m, arch);
        for (const sm of m.statMods) {
          total++;
          // Probe at 100: every mult is != 1 and every flat != 0, so an applied
          // statMod always moves the value.
          const single: EliteModifier = { ...m, statMods: [sm] };
          const applies = arch.stats.some((s) => applyModifiers(100, s.label, [single]) !== 100);
          if (!applies && !inert.includes(sm.label)) silent++;
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(silent).toBe(0);
  });
});
