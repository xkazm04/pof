import type { SubModuleId } from '@/types/modules';
import type { StatusKey } from './constants';

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

/** The heatmap status cell whose features the drill panel shows. */
export interface SelectedCell {
  moduleId: SubModuleId;
  status: StatusKey;
}
