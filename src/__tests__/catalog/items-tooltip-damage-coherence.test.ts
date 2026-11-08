import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * One authority per quantity: the Items Tooltip states the weapon numbers the Damage / Implicit
 * step derived for the SAME entity. Until 2026-11-08 the tooltip was a hand-typed constant
 * ('Physical Damage: 8–12', 'Attacks per Second: 1.25', 'Critical Strike Chance: 5%') while the
 * Damage step derived 12–18 / 0.8333 APS / 5.5% for item-1 — and printed the same sword lines for
 * every seeded item, armour included.
 */

const steps = getCatalogPipeline('items')!.steps;
const step = (label: string) => steps.find((s) => s.label === label)!;
const entities = Object.values(seedAllCatalogs().items ?? {}) as unknown as LabEntity[];

type Damage = { damageMin?: number; damageMax?: number; attackSpeed?: number; critChance?: number; implicit?: unknown };

function readBoth(e: LabEntity) {
  const damage = (step('Damage / Implicit').produce(e).data as { damage: Damage }).damage;
  const tooltip = (step('Tooltip / Compare').produce(e).data as { tooltip: { statLines: string[]; implicitLine?: string } }).tooltip;
  return { damage, tooltip };
}

describe('items Tooltip / Compare agrees with Damage / Implicit', () => {
  it('has seeded items to check', () => {
    expect(entities.length).toBeGreaterThan(0);
  });

  it.each(entities.map((e) => [e.id, e] as const))('%s: the damage line is the Damage step’s range, or absent', (_id, e) => {
    const { damage, tooltip } = readBoth(e);
    const dmgLines = tooltip.statLines.filter((l) => l.startsWith('Physical Damage'));
    if (damage.damageMin != null && damage.damageMax != null) {
      expect(dmgLines).toEqual([`Physical Damage: ${damage.damageMin}–${damage.damageMax}`]);
    } else {
      expect(dmgLines).toEqual([]);
    }
  });

  it.each(entities.map((e) => [e.id, e] as const))('%s: attack speed and crit lines carry the Damage step’s values, or are absent', (_id, e) => {
    const { damage, tooltip } = readBoth(e);
    const aps = tooltip.statLines.filter((l) => l.startsWith('Attacks per Second'));
    const crit = tooltip.statLines.filter((l) => l.startsWith('Critical Strike Chance'));
    expect(aps).toEqual(damage.attackSpeed != null ? [`Attacks per Second: ${damage.attackSpeed.toFixed(2)}`] : []);
    expect(crit).toEqual(damage.critChance != null ? [`Critical Strike Chance: ${Math.round(damage.critChance * 1000) / 10}%`] : []);
  });

  it.each(entities.map((e) => [e.id, e] as const))('%s: the implicit line is the Damage step’s implicit, or absent', (_id, e) => {
    const { damage, tooltip } = readBoth(e);
    const label = typeof damage.implicit === 'object' && damage.implicit !== null
      ? (damage.implicit as { label?: string }).label
      : undefined;
    expect(tooltip.implicitLine).toBe(label);
  });
});

describe('items Economy states the ratio it computed', () => {
  it('the balance note names the derived pricePowerRatio, not a rounded 1.0', () => {
    const e = entities[0];
    const data = step('Economy').produce(e).data as { pricePowerRatio: number; economy: { balanceNote: string } };
    expect(data.pricePowerRatio).not.toBe(1);
    expect(data.economy.balanceNote).toContain(`pricePowerRatio(${data.pricePowerRatio})`);
  });
});

describe('items Economy power follows the entity own Damage step', () => {
  it.each(entities.map((e) => [e.id, e] as const))('%s: dpsPower is the Damage step baseDPS x 0.8 (one-hand norm)', (_id, e) => {
    const damageData = step('Damage / Implicit').produce(e).data as { baseDPS?: number };
    const economy = (step('Economy').produce(e).data as { economy: { powerScore: number; powerBreakdown: { dpsPower: number; implicitAccuracyPower: number; affixPower: number } } }).economy;
    expect(economy.powerBreakdown.dpsPower).toBe(Math.round((damageData.baseDPS ?? 0) * 0.8 * 100) / 100);
    const { dpsPower, implicitAccuracyPower, affixPower } = economy.powerBreakdown;
    expect(economy.powerScore).toBeCloseTo(dpsPower + implicitAccuracyPower + affixPower, 6);
  });
});
