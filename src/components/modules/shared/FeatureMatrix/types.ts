import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';

export type SortKey = 'name' | 'status' | 'quality' | 'reviewed';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'grouped' | 'flat';

export interface FeatureMatrixProps {
  moduleId: SubModuleId;
  accentColor: string;
  onReview: () => void;
  onSync?: () => void;
  isReviewing: boolean;
  onFix?: (feature: FeatureRow) => void;
  isFixing?: boolean;
  onReviewFeature?: (feature: FeatureRow) => void;
}
