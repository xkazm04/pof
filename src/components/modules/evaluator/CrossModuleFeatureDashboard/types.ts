import type { SubModuleId } from '@/types/modules';

// ── Types ──

export interface CellData {
  moduleId: SubModuleId;
  label: string;
  category: string;
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  pctComplete: number;
}

export interface MissingFeatureGroup {
  featureName: string;
  modules: string[];
}
