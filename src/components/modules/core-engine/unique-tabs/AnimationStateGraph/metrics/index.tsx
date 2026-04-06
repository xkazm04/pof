'use client';

import type { ReactNode } from 'react';
import { StatesMetric } from './StatesMetric';
import { TransitionsMetric } from './TransitionsMetric';
import { HeatmapMetric } from './HeatmapMetric';
import { ChainMetric } from './ChainMetric';
import { MontagesMetric } from './MontagesMetric';
import { ScrubberMetric } from './ScrubberMetric';
import { SkeletonMetric } from './SkeletonMetric';
import { TrajectoriesMetric } from './TrajectoriesMetric';
import { AssetsMetric } from './AssetsMetric';
import { PlayrateMetric } from './PlayrateMetric';

const METRIC_MAP: Record<string, () => ReactNode> = {
  states: () => <StatesMetric />,
  transitions: () => <TransitionsMetric />,
  heatmap: () => <HeatmapMetric />,
  chain: () => <ChainMetric />,
  montages: () => <MontagesMetric />,
  scrubber: () => <ScrubberMetric />,
  skeleton: () => <SkeletonMetric />,
  trajectories: () => <TrajectoriesMetric />,
  assets: () => <AssetsMetric />,
  playrate: () => <PlayrateMetric />,
};

export function renderAnimMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
