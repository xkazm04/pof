'use client';

import { useMemo } from 'react';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { MODULE_FEATURE_DEFINITIONS, type FeatureDefinition } from '@/lib/feature-definitions';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

export interface TabFeatureStats {
  total: number;
  implemented: number;
  partial: number;
  missing: number;
}

interface UseTabFeaturesResult {
  featureMap: Map<string, FeatureRow>;
  stats: TabFeatureStats;
  features: FeatureRow[];
  defs: FeatureDefinition[];
  isLoading: boolean;
}

export function useTabFeatures(moduleId: SubModuleId): UseTabFeaturesResult {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo((): TabFeatureStats => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  return { featureMap, stats, features, defs, isLoading };
}
