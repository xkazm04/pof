import type { OverlapPair } from '@/lib/overlap-detection';
import type { TwinKind } from '@/lib/evaluator/overlap-twins';
import { STATUS_ERROR, STATUS_WARNING, STATUS_STALE, STATUS_SUCCESS, STATUS_NEUTRAL } from '@/lib/chart-colors';

// ── Reason labels + colors ──

export const REASON_CONFIG: Record<OverlapPair['reason'], { label: string; color: string }> = {
  name_match: { label: 'Name Match', color: STATUS_ERROR },
  description_similarity: { label: 'Description Overlap', color: STATUS_WARNING },
  shared_category_keywords: { label: 'Shared Category', color: STATUS_STALE },
};

export type FilterReason = OverlapPair['reason'] | 'all';

// ── Twin status labels + colors ──

export const TWIN_KIND_CONFIG: Record<TwinKind, { label: string; color: string }> = {
  diverged: { label: 'Diverged', color: STATUS_ERROR },
  unreviewed: { label: 'Unreviewed', color: STATUS_WARNING },
  'agreed-open': { label: 'Both open', color: STATUS_NEUTRAL },
  'agreed-done': { label: 'Both done', color: STATUS_SUCCESS },
};
