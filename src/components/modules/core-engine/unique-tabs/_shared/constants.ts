import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  STATUS_SUBDUED,
  OPACITY_8, OPACITY_10,
  withOpacity,
} from '@/lib/chart-colors';
import type { FeatureStatus } from '@/types/feature-matrix';

/* ── Stagger Animation Variants ───────────────────────────────────────────── */

import { ANIMATION_PRESETS } from '@/lib/motion';

/** Stagger delay (seconds) for default grid/list item entrance */
export const STAGGER_DEFAULT = ANIMATION_PRESETS.stagger.default;

/** Stagger delay (seconds) for slower, more dramatic item entrance */
export const STAGGER_SLOW = ANIMATION_PRESETS.stagger.slow;

/* ── Shared STATUS_COLORS ─────────────────────────────────────────────────── */

export const STATUS_COLORS: Record<FeatureStatus, { dot: string; bg: string; label: string }> = {
  implemented: { dot: STATUS_SUCCESS, bg: withOpacity(STATUS_SUCCESS, OPACITY_8), label: 'Implemented' },
  improved: { dot: STATUS_IMPROVED, bg: withOpacity(STATUS_IMPROVED, OPACITY_8), label: 'Improved' },
  partial: { dot: STATUS_WARNING, bg: withOpacity(STATUS_WARNING, OPACITY_8), label: 'Partial' },
  missing: { dot: STATUS_ERROR, bg: withOpacity(STATUS_ERROR, OPACITY_8), label: 'Missing' },
  unknown: { dot: STATUS_SUBDUED, bg: withOpacity(STATUS_SUBDUED, OPACITY_10), label: 'Unknown' },
};

/* ── Safe status lookup ───────────────────────────────────────────────────── */

const FALLBACK_STATUS = STATUS_COLORS.unknown;

/** Returns dot color + label for a FeatureStatus, falling back to 'unknown' for unrecognized values. */
export function statusInfo(status: FeatureStatus | undefined): { color: string; label: string } {
  const sc = (status && STATUS_COLORS[status]) || FALLBACK_STATUS;
  return { color: sc.dot, label: sc.label };
}
