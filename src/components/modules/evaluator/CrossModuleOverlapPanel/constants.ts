import type { OverlapPair } from '@/lib/overlap-detection';
import { STATUS_ERROR, STATUS_WARNING, STATUS_STALE } from '@/lib/chart-colors';

// ── Reason labels + colors ──

export const REASON_CONFIG: Record<OverlapPair['reason'], { label: string; color: string }> = {
  name_match: { label: 'Name Match', color: STATUS_ERROR },
  description_similarity: { label: 'Description Overlap', color: STATUS_WARNING },
  shared_category_keywords: { label: 'Shared Category', color: STATUS_STALE },
};

export type FilterReason = OverlapPair['reason'] | 'all';
