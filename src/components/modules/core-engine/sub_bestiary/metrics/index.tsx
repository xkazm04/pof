'use client';

import type { ReactNode } from 'react';
import { CardsMetric } from './CardsMetric';
import { ModifiersMetric } from './ModifiersMetric';
import { RadarMetric } from './RadarMetric';
import { BehaviorTreeMetric } from './BehaviorTreeMetric';
import { DecisionLogMetric } from './DecisionLogMetric';
import { AggroMetric } from './AggroMetric';
import { FormationsMetric } from './FormationsMetric';
import { WavesMetric } from './WavesMetric';
import { DifficultyMetric } from './DifficultyMetric';

const METRIC_MAP: Record<string, () => ReactNode> = {
  cards: () => <CardsMetric />,
  modifiers: () => <ModifiersMetric />,
  radar: () => <RadarMetric />,
  'behavior-tree': () => <BehaviorTreeMetric />,
  'decision-log': () => <DecisionLogMetric />,
  aggro: () => <AggroMetric />,
  formations: () => <FormationsMetric />,
  waves: () => <WavesMetric />,
  difficulty: () => <DifficultyMetric />,
};

export function renderBestiaryMetric(sectionId: string): ReactNode {
  return METRIC_MAP[sectionId]?.() ?? null;
}
