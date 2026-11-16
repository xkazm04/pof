import { describe, it, expect } from 'vitest';
import { lootMetricsView, LOOT_PIPELINE_STAGES } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';
import { initialTunerState, tunerReducer, exactEV, type TunerState } from '@/components/modules/core-engine/sub_loot/_shared/bindingTuner';
import { DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import { findPercentileKill } from '@/components/modules/core-engine/sub_loot/_shared/math';
import { getAllSectionIds, getSections } from '@/components/modules/core-engine/unique-tabs/feature-map-config';

// The loot Feature Map's glyphs read ONE typed view over live module state (the
// tuned roster + the pity threshold), not 11 import-time constants.

const untuned = (): TunerState => initialTunerState(DEFAULT_ENEMY_LOOT_BINDINGS, DEFAULT_RARITY_GOLD);
const LEGENDARY_RATE = 0.02;

describe('lootMetricsView', () => {
  it('timer reads the live pity threshold', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 35 });
    expect(v.timer).toMatchObject({ value: 35, unit: 'kills', basis: 'live' });
  });

  it('timer counts the pity threshold in the unit drought and the Pity tab use (kills, never pulls)', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 35 });
    // findPercentileKill caps the dry streak at the threshold, so it is a kill count.
    expect(v.timer.unit).toBe(v.drought.unit);
    expect(v.timer.detail).toMatch(/35 kills/);
    expect(`${v.timer.unit} ${v.timer.detail}`).not.toMatch(/pull/i);
  });

  it('drought is the Legendary p95 with the live pity, and moves with it', () => {
    for (const t of [20, 60]) {
      const v = lootMetricsView({ tuning: untuned(), pityThreshold: t });
      expect(v.drought.value).toBe(findPercentileKill(LEGENDARY_RATE, 95, t));
    }
    // Above the unpitied p95 the reading stops tracking the threshold (kills an echo stub).
    const high = lootMetricsView({ tuning: untuned(), pityThreshold: 200 });
    expect(high.drought.value).toBe(findPercentileKill(LEGENDARY_RATE, 95, 200));
    expect(high.drought.value).toBe(149);
  });

  it('drought carries the unpitied p95 alongside the pitied one, and its detail names both', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 35 });
    expect(v.drought).toMatchObject({ value: 35, unpitied: 149, basis: 'live' });
    expect(v.drought.unpitied).toBe(findPercentileKill(LEGENDARY_RATE, 95, null));
    expect(v.drought.detail).toMatch(/149/);
    expect(v.drought.detail).toMatch(/35 with pity/);
  });

  it('impact is the tuned-roster EV delta vs baseline (0 and labelled untuned before any tune)', () => {
    const base = untuned();
    expect(lootMetricsView({ tuning: base, pityThreshold: 20 }).impact).toMatchObject({ value: 0, basis: 'tuned', label: 'untuned' });

    const tuned = tunerReducer(base, { type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 0.6 });
    const sum = (list: TunerState['bindings'], gold: Record<string, number>) => list.reduce((s, b) => s + exactEV(b, gold), 0);
    const expected = sum(tuned.bindings, tuned.rarityGold) - sum(tuned.baseline, tuned.baselineGold);
    const impact = lootMetricsView({ tuning: tuned, pityThreshold: 20 }).impact;
    expect(impact.basis).toBe('tuned');
    expect(impact.value).toBeCloseTo(expected, 9);
    expect(impact.value).toBeGreaterThan(0);
    expect(impact.label).not.toBe('untuned');
  });

  it('pipeline is the stage count with the stage flow as its detail (the glyph prints it)', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 20 });
    expect(v.pipeline).toMatchObject({ value: LOOT_PIPELINE_STAGES.length, unit: 'stages', basis: 'fixture' });
    expect(LOOT_PIPELINE_STAGES).toHaveLength(5);
    expect(v.pipeline.detail).toBe(LOOT_PIPELINE_STAGES.join(' → '));
  });

  it('has exactly one reading per arpg-loot Feature Map section', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 20 });
    const ids = getAllSectionIds('arpg-loot');
    expect(ids).toHaveLength(11);
    expect(Object.keys(v).sort()).toEqual([...ids].sort());
  });

  it('every section without a live or tuned input is labelled fixture', () => {
    const v = lootMetricsView({ tuning: untuned(), pityThreshold: 20 });
    const fixtures = ['pipeline', 'weights', 'world-items', 'treemap', 'histogram', 'simulator', 'co-occurrence', 'beacon'] as const;
    for (const id of fixtures) expect(v[id].basis, id).toBe('fixture');
    expect(v.timer.basis).toBe('live');
    expect(v.drought.basis).toBe('live');
    expect(v.impact.basis).toBe('tuned');
  });

  it('the Pipeline card summary names every stage the glyph draws', () => {
    const summary = getSections('arpg-loot').find((x) => x.id === 'pipeline')?.summary ?? '';
    for (const stage of LOOT_PIPELINE_STAGES) expect(summary, stage).toContain(stage);
  });
});
