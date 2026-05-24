'use client';

import type { ReactNode } from 'react';
import { LanesMetric } from './LanesMetric';
import { SequencesMetric } from './SequencesMetric';
import { TracesMetric } from './TracesMetric';
import { StatsMetric } from './StatsMetric';
import { FeedbackTunerMetric } from './FeedbackTunerMetric';
import { DpsMetric } from './DpsMetric';
import { EffectivenessMetric } from './EffectivenessMetric';
import { SankeyMetric } from './SankeyMetric';
import { KpisMetric } from './KpisMetric';

const METRIC_MAP: Record<string, () => ReactNode> = {
  lanes: () => <LanesMetric />,
  sequences: () => <SequencesMetric />,
  traces: () => <TracesMetric />,
  stats: () => <StatsMetric />,
  'feedback-tuner': () => <FeedbackTunerMetric />,
  dps: () => <DpsMetric />,
  effectiveness: () => <EffectivenessMetric />,
  sankey: () => <SankeyMetric />,
  kpis: () => <KpisMetric />,
};

export function renderCombatMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
