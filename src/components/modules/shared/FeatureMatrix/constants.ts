import { CheckCircle, Sparkles, CircleDashed, Circle, HelpCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { FeatureStatus } from '@/types/feature-matrix';
import { FEATURE_STATUS_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, STATUS_LIME, STATUS_SUCCESS, STATUS_NEUTRAL, ACCENT_CYAN_LIGHT, OPACITY_10 } from '@/lib/chart-colors';

// Single source of truth for feature-status presentation. Status is encoded by
// SHAPE (a distinct lucide glyph) as well as color, so the matrix stays legible
// to colorblind users (WCAG 1.4.1 — color is never the sole visual cue). Every
// surface (summary legend, filter chips, feature rows) reads `icon` from here,
// so adding/changing a glyph updates them all together.
export const STATUS_CONFIG: Record<FeatureStatus, { color: string; bg: string; label: string; plain: string; action: string; icon: typeof CheckCircle }> = {
  implemented: { color: FEATURE_STATUS_COLORS.implemented, bg: FEATURE_STATUS_COLORS.implemented + OPACITY_10, label: 'Implemented', plain: 'Fully built and ready to use', action: 'Review for quality improvements', icon: CheckCircle },
  improved: { color: FEATURE_STATUS_COLORS.improved, bg: FEATURE_STATUS_COLORS.improved + OPACITY_10, label: 'Improved', plain: 'Built and recently enhanced', action: 'Verify improvements work as expected', icon: Sparkles },
  partial: { color: FEATURE_STATUS_COLORS.partial, bg: FEATURE_STATUS_COLORS.partial + OPACITY_10, label: 'Partial', plain: 'Partially built — some work still needed', action: 'Continue implementation to complete', icon: CircleDashed },
  missing: { color: FEATURE_STATUS_COLORS.missing, bg: FEATURE_STATUS_COLORS.missing + OPACITY_10, label: 'Missing', plain: 'Not yet built — needs implementation', action: 'Start building this feature', icon: Circle },
  unknown: { color: FEATURE_STATUS_COLORS.unknown, bg: 'var(--border)', label: 'Unknown', plain: 'Not yet reviewed — status unclear', action: 'Run a scan to determine status', icon: HelpCircle },
};

export const STAR_COLORS = [
  '',             // 0 — unused
  STATUS_ERROR,   // 1 — red
  STATUS_BLOCKER, // 2 — orange
  STATUS_WARNING, // 3 — amber
  STATUS_LIME,    // 4 — lime
  STATUS_SUCCESS, // 5 — green
];

export const STATUS_ORDER: Record<FeatureStatus, number> = {
  missing: 0,
  unknown: 1,
  partial: 2,
  implemented: 3,
  improved: 4,
};

export const VERIFY_BADGE_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  implemented: { icon: ShieldCheck, color: STATUS_SUCCESS, label: 'verified' },
  improved: { icon: ShieldCheck, color: ACCENT_CYAN_LIGHT, label: 'verified' },
  partial: { icon: ShieldCheck, color: STATUS_WARNING, label: 'partial' },
  missing: { icon: AlertTriangle, color: STATUS_ERROR, label: 'not found' },
  unknown: { icon: ShieldCheck, color: STATUS_NEUTRAL, label: 'unknown' },
};
