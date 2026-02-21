/**
 * Centralized semantic color palette for charts, badges, and status indicators.
 *
 * Use these constants instead of hardcoding hex values so every dashboard,
 * SVG fill, and badge background shares the same visual language.
 */

// ── Status colors (semantic) ────────────────────────────────────────────────

/** Green — success, implemented, healthy, high quality */
export const STATUS_SUCCESS = '#4ade80';

/** Amber — warning, partial, mid-range, caution */
export const STATUS_WARNING = '#fbbf24';

/** Red — error, missing, failure, low quality */
export const STATUS_ERROR = '#f87171';

/** Blue — informational, neutral highlights, activity */
export const STATUS_INFO = '#60a5fa';

/** Orange — blocker, blocked dependency, moderate alert */
export const STATUS_BLOCKER = '#fb923c';

/** Purple — stale, duration/time metric, historical */
export const STATUS_STALE = '#8b5cf6';

/** Neutral gray — disabled, unknown, inactive */
export const STATUS_NEUTRAL = '#6b7280';

/** Lime — quality 4, "good but not great" */
export const STATUS_LIME = '#a3e635';

/** Sky blue — improved features */
export const STATUS_IMPROVED = '#38bdf8';

// ── Extended accent palette ─────────────────────────────────────────────────

/** Violet — animations, audio, content decorative accent */
export const ACCENT_VIOLET = '#a78bfa';

/** Orange — game director, secondary alert, warm accent */
export const ACCENT_ORANGE = '#f97316';

/** Emerald — healthy, ecosystem, nature contexts */
export const ACCENT_EMERALD = '#34d399';

/** Cyan — interactive, event bus, economy systems */
export const ACCENT_CYAN = '#06b6d4';

/** Pink — UI flow, menu navigation, creative accent */
export const ACCENT_PINK = '#f472b6';

// ── Opacity helpers — append to any hex color ───────────────────────────────

/** 5% opacity suffix */
export const OPACITY_5 = '0d';
/** 8% opacity suffix */
export const OPACITY_8 = '14';
/** 10% opacity suffix */
export const OPACITY_10 = '1a';
/** 12% opacity suffix */
export const OPACITY_12 = '1f';
/** 15% opacity suffix */
export const OPACITY_15 = '26';
/** 20% opacity suffix */
export const OPACITY_20 = '33';
/** 30% opacity suffix */
export const OPACITY_30 = '4d';

// ── Module / category accent colors ─────────────────────────────────────────

export const MODULE_COLORS = {
  setup: '#00ff88',
  core: '#3b82f6',
  content: '#f59e0b',
  systems: '#8b5cf6',
  evaluator: '#ef4444',
} as const;

// ── Quality score color mapping ─────────────────────────────────────────────

const QUALITY_COLORS = [
  '',             // 0 — unused
  STATUS_ERROR,   // 1 — red
  STATUS_BLOCKER, // 2 — orange
  STATUS_WARNING, // 3 — amber
  STATUS_LIME,    // 4 — lime
  STATUS_SUCCESS, // 5 — green
] as const;

/** Map a 1-5 quality score to its semantic color. */
export function qualityColor(score: number | null): string {
  if (score === null || score < 1 || score > 5) return 'var(--text-muted)';
  return QUALITY_COLORS[score];
}

// ── Feature status colors ───────────────────────────────────────────────────

export const FEATURE_STATUS_COLORS = {
  implemented: STATUS_SUCCESS,
  improved: STATUS_IMPROVED,
  partial: STATUS_WARNING,
  missing: STATUS_ERROR,
  unknown: 'var(--text-muted)',
} as const;

// ── Insight / severity colors ───────────────────────────────────────────────

export const SEVERITY_COLORS = {
  critical: STATUS_ERROR,
  warning: STATUS_WARNING,
  info: STATUS_INFO,
  positive: STATUS_SUCCESS,
} as const;

// ── Health score thresholds ─────────────────────────────────────────────────

/** Return a semantic color for a 0-100 health/progress score. */
export function healthColor(score: number): string {
  if (score >= 60) return STATUS_SUCCESS;
  if (score >= 30) return STATUS_WARNING;
  return STATUS_ERROR;
}
