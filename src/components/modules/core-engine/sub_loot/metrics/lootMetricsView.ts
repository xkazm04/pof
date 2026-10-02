/**
 * The loot Feature Map's ONE read model. Every glyph's number comes from here,
 * derived from live module state (the tuned roster in useLootTuningStore and the
 * Pity tab's threshold) instead of a constant computed when its file was imported.
 *
 * Each reading carries its basis so a number never poses as more than it is:
 * - 'live'    — follows a control the designer moves (the pity threshold);
 * - 'tuned'   — the Core-tab what-if against the shipped roster;
 * - 'fixture' — hand-authored sample data; the glyph says so.
 * Pure: the Feature Map renders it (metrics/index.tsx).
 */

import type { SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import { exactEV, type TunerState } from '@/components/modules/core-engine/sub_loot/_shared/bindingTuner';
import { findPercentileKill } from '@/components/modules/core-engine/sub_loot/_shared/math';
import {
  AFFIX_COOCCURRENCE_CELLS, AFFIX_POOL, BEACON_CONFIGS, DROUGHT_RARITY_OPTIONS,
  RARITY_TIERS, TREEMAP_DATA, WORLD_ITEMS,
} from '@/components/modules/core-engine/sub_loot/_shared/data';

/**
 * The arpg-loot Feature Map section ids. Each must be a real SectionId (typecheck);
 * set equality with getAllSectionIds('arpg-loot') is pinned by loot-metrics-view.test.
 */
export const LOOT_SECTION_IDS = [
  'pipeline', 'weights', 'world-items', 'treemap', 'histogram', 'simulator',
  'co-occurrence', 'timer', 'drought', 'beacon', 'impact',
] as const satisfies readonly SectionId[];

export type LootSectionId = (typeof LOOT_SECTION_IDS)[number];

export type MetricBasis = 'live' | 'tuned' | 'fixture';

export interface MetricReading {
  /** The number the glyph prints; null when the glyph is a diagram with no number. */
  value: number | null;
  unit: string;
  basis: MetricBasis;
  label?: string;
  /** Hover text: what the number is and what it was derived from. */
  detail?: string;
  /** Drought only: the p95 dry streak with NO pity, beside the pitied `value`. */
  unpitied?: number;
}

export interface LootMetricsInput {
  tuning: Pick<TunerState, 'bindings' | 'baseline' | 'rarityGold' | 'baselineGold'>;
  pityThreshold: number;
}

/** A co-occurrence cell at or above this share is a "hot" affix-pair conflict. */
export const AFFIX_HOT_THRESHOLD = 0.7;

const DROUGHT_PERCENTILE = 95;
const DROUGHT_RARITY = 'Legendary';

export function isLootSectionId(id: string): id is LootSectionId {
  return (LOOT_SECTION_IDS as readonly string[]).includes(id);
}

function droughtReading(pityThreshold: number): MetricReading {
  const opt = DROUGHT_RARITY_OPTIONS.find((o) => o.name === DROUGHT_RARITY);
  if (!opt || opt.dropRate <= 0) {
    return { value: null, unit: 'kills', basis: 'live', label: `${DROUGHT_RARITY} p${DROUGHT_PERCENTILE}`, detail: `No ${DROUGHT_RARITY} tier in the rarity table` };
  }
  const value = findPercentileKill(opt.dropRate, DROUGHT_PERCENTILE, pityThreshold);
  const unpitied = findPercentileKill(opt.dropRate, DROUGHT_PERCENTILE, null);
  return {
    value, unpitied, unit: 'kills', basis: 'live', label: `${DROUGHT_RARITY} p${DROUGHT_PERCENTILE}`,
    detail: `${DROUGHT_RARITY} p${DROUGHT_PERCENTILE} ${unpitied} kills -> ${value} with pity ${pityThreshold}`,
  };
}

function impactReading(tuning: LootMetricsInput['tuning']): MetricReading {
  const untouched = tuning.bindings === tuning.baseline && tuning.rarityGold === tuning.baselineGold;
  const unit = 'g/kill';
  if (untouched) {
    return { value: 0, unit, basis: 'tuned', label: 'untuned', detail: 'Shipped roster - tune a binding on the Core tab to see its EV impact' };
  }
  const before = tuning.baseline.reduce((s, b) => s + exactEV(b, tuning.baselineGold), 0);
  const after = tuning.bindings.reduce((s, b) => s + exactEV(b, tuning.rarityGold), 0);
  return {
    value: after - before, unit, basis: 'tuned', label: 'vs shipped',
    detail: `Sum of EV/kill over ${tuning.bindings.length} archetypes: ${before.toFixed(1)} -> ${after.toFixed(1)} g`,
  };
}

const fixture = (value: number | null, unit: string, detail: string): MetricReading => ({ value, unit, basis: 'fixture', detail });

export function lootMetricsView({ tuning, pityThreshold }: LootMetricsInput): Record<LootSectionId, MetricReading> {
  const hot = AFFIX_COOCCURRENCE_CELLS.filter((c) => c.value >= AFFIX_HOT_THRESHOLD).length;
  return {
    pipeline: fixture(null, 'stages', 'Roll -> rarity -> affix -> drop flow'),
    weights: fixture(RARITY_TIERS.length, 'tiers', 'Rarity weight split'),
    'world-items': fixture(WORLD_ITEMS.length, 'world items', 'World item beams'),
    treemap: fixture(TREEMAP_DATA.length, 'nodes', 'Drop chance hierarchy'),
    histogram: fixture(RARITY_TIERS.length, 'brackets', 'Rarity weight histogram'),
    simulator: fixture(AFFIX_POOL.length, 'affixes in pool', 'Affix pool'),
    'co-occurrence': fixture(hot, 'hot cells', `${hot} of ${AFFIX_COOCCURRENCE_CELLS.length} affix pairs >= ${AFFIX_HOT_THRESHOLD * 100}%`),
    timer: { value: pityThreshold, unit: 'pulls', basis: 'live', detail: `${pityThreshold} pulls until pity` },
    drought: droughtReading(pityThreshold),
    beacon: fixture(BEACON_CONFIGS.length, 'beacons', 'Rarity beacon configs'),
    impact: impactReading(tuning),
  } satisfies Record<LootSectionId, MetricReading>;
}
