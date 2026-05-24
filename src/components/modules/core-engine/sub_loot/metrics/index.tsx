'use client';

import type { ReactNode } from 'react';
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

const METRIC_MAP: Record<string, () => ReactNode> = {
  pipeline: () => <PipelineMetric />,
  weights: () => <WeightsMetric />,
  'world-items': () => <WorldItemsMetric />,
  treemap: () => <TreemapMetric />,
  histogram: () => <HistogramMetric />,
  simulator: () => <SimulatorMetric />,
  'co-occurrence': () => <CoOccurrenceMetric />,
  timer: () => <TimerMetric />,
  drought: () => <DroughtMetric />,
  beacon: () => <BeaconMetric />,
  impact: () => <ImpactMetric />,
};

export function renderLootMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
