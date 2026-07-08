import type { SubModuleId } from '@/types/modules';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CellData {
  moduleId: SubModuleId;
  label: string;
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
  lastReviewedAt: string | null;
  daysSinceReview: number | null;
  pctComplete: number;
  pctReviewed: number;
}

export interface Props {
  staleDays?: number;
  onReviewModule?: (moduleId: SubModuleId) => void;
  onBatchReview?: (moduleIds: string[]) => void;
}

export interface Totals {
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  reviewed: number;
}
