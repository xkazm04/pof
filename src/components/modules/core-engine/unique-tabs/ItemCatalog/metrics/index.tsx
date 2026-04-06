'use client';

import type { ReactNode } from 'react';
import { GridMetric } from './GridMetric';
import { SetsMetric } from './SetsMetric';
import { LoadoutMetric } from './LoadoutMetric';
import { SourcesMetric } from './SourcesMetric';
import { ScalingMetric } from './ScalingMetric';
import { StatsMetric } from './StatsMetric';
import { PowerMetric } from './PowerMetric';

const METRIC_MAP: Record<string, () => ReactNode> = {
  grid: () => <GridMetric />,
  sets: () => <SetsMetric />,
  loadout: () => <LoadoutMetric />,
  sources: () => <SourcesMetric />,
  scaling: () => <ScalingMetric />,
  'inv-stats': () => <StatsMetric />,
  power: () => <PowerMetric />,
};

export function renderItemMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
