'use client';

import FeatureMapTab from '../../unique-tabs/FeatureMapTab';
import { getCharacterMetric } from '../metrics';
import type { SubModuleId } from '@/types/modules';

interface Props { moduleId: SubModuleId }

export function FeaturesTab({ moduleId }: Props) {
  return <FeatureMapTab moduleId={moduleId} renderMetric={getCharacterMetric} />;
}
