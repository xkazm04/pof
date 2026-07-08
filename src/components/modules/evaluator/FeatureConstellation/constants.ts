import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureStatus } from '@/types/feature-matrix';

// ── Constants ────────────────────────────────────────────────────────────────

export const NODE_W = 158;
export const NODE_H = 56;
export const STATUS_ORDER: readonly FeatureStatus[] = FEATURE_STATUSES;
export const STATUS_LABEL: Record<FeatureStatus, string> = {
  implemented: 'Done', improved: 'Improved', partial: 'Partial', missing: 'Missing', unknown: 'Unknown',
};

/** Modules that have a feature graph to render, in registry order. */
export const GRAPH_MODULES = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

export interface StatusRow { moduleId: string; featureName: string; status: FeatureStatus }
