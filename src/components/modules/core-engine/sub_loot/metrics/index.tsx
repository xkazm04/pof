'use client';

import { useMemo, type ReactNode } from 'react';
import { useLootTuningStore } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';
import { PipelineMetric } from './PipelineMetric';
import { WeightsMetric } from './WeightsMetric';
import { WorldItemsMetric } from './WorldItemsMetric';
import { TreemapMetric } from './TreemapMetric';
import { HistogramMetric } from './HistogramMetric';
import { SimulatorMetric } from './SimulatorMetric';
import { CoOccurrenceMetric } from './CoOccurrenceMetric';
import { TimerMetric } from './TimerMetric';
import { DroughtMetric } from './DroughtMetric';
import { BeaconMetric } from './BeaconMetric';
import { ImpactMetric } from './ImpactMetric';
import { isLootSectionId, lootMetricsView, type LootSectionId, type MetricReading } from '@/components/modules/core-engine/sub_loot/metrics/lootMetricsView';

/** One glyph per arpg-loot section; each receives its reading from the one view. */
const GLYPHS = {
  pipeline: (r) => <PipelineMetric reading={r} />,
  weights: () => <WeightsMetric />,
  'world-items': (r) => <WorldItemsMetric reading={r} />,
  treemap: () => <TreemapMetric />,
  histogram: (r) => <HistogramMetric reading={r} />,
  simulator: (r) => <SimulatorMetric reading={r} />,
  'co-occurrence': (r) => <CoOccurrenceMetric reading={r} />,
  timer: (r) => <TimerMetric reading={r} />,
  drought: (r) => <DroughtMetric reading={r} />,
  beacon: (r) => <BeaconMetric reading={r} />,
  impact: (r) => <ImpactMetric reading={r} />,
} satisfies Record<LootSectionId, (reading: MetricReading) => ReactNode>;

/** The live view: re-derives when the tuned roster, gold tables or pity threshold change. */
export function useLootMetricsView(): Record<LootSectionId, MetricReading> {
  const bindings = useLootTuningStore((s) => s.bindings);
  const baseline = useLootTuningStore((s) => s.baseline);
  const rarityGold = useLootTuningStore((s) => s.rarityGold);
  const baselineGold = useLootTuningStore((s) => s.baselineGold);
  const pityThreshold = useLootTuningStore((s) => s.pityThreshold);
  return useMemo(
    () => lootMetricsView({ tuning: { bindings, baseline, rarityGold, baselineGold }, pityThreshold }),
    [bindings, baseline, rarityGold, baselineGold, pityThreshold],
  );
}

function LootMetric({ id }: { id: LootSectionId }) {
  const reading = useLootMetricsView()[id];
  const glyph = GLYPHS[id](reading);
  if (reading.basis !== 'fixture') return <>{glyph}</>;
  // Hand-authored numbers say so instead of posing as measured ones - on hover (title)
  // and in the text assistive tech reads, since the glyph marks are aria-hidden.
  return (
    <span className="inline-flex" title={`${reading.detail ?? reading.unit} - sample data, not measured`}>
      {glyph}
      <span className="sr-only"> (sample data, not measured)</span>
    </span>
  );
}

export function renderLootMetric(sectionId: string): ReactNode {
  return isLootSectionId(sectionId) ? <LootMetric id={sectionId} /> : null;
}
