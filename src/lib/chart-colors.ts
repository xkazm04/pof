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

/** Purple — arcane/magical, crafting accents */
export const ACCENT_PURPLE = '#c084fc';

/** Red-500 — bold red for damage, combat, warrior contexts */
export const ACCENT_RED = '#ef4444';

/** Purple-500 — vivid purple for abilities, arcane, spellcasting */
export const ACCENT_PURPLE_BOLD = '#a855f7';

/** Green-500 — vivid green for healing, rogue, ready/available */
export const ACCENT_GREEN = '#22c55e';

/** Emerald-500 — darker emerald for borders and emphasis */
export const ACCENT_EMERALD_DARK = '#10b981';

/** Cyan-400 — lighter cyan for text on dark backgrounds */
export const ACCENT_CYAN_LIGHT = '#22d3ee';

/** White — for overlays, borders, glows on dark backgrounds */
export const OVERLAY_WHITE = '#ffffff';

/** Pure black — overlays, text on bright surfaces */
export const OVERLAY_BLACK = '#000000';

/** Vivid blue used for primary action button glows (matches Tailwind blue-600). */
export const ACCENT_BLUE_BOLD = '#2563eb';

// ── Opacity helpers — append to any hex color ───────────────────────────────
//
// Canonical 6-stop scale: 5 / 10 / 20 / 40 / 60 / 80. Any other token below is
// either a fully-transparent/opaque endpoint (`OPACITY_0`) or a `@deprecated`
// alias kept for source-compat — new code should use the canonical six. Stops
// previously at "off-grid" percentages (22, 37, 56, 87) now alias to the
// nearest canonical to slim the scale; tokens that would have caused a visible
// shift are kept for now but marked deprecated.

/** Canonical — 5% opacity suffix. */
export const OPACITY_5 = '0d';
/** Canonical — 10% opacity suffix. */
export const OPACITY_10 = '1a';
/** Canonical — 20% opacity suffix. */
export const OPACITY_20 = '33';
/** Canonical — 40% opacity suffix (medium emphasis fills and strokes). */
export const OPACITY_40 = '66';
/** Canonical — 60% opacity suffix. */
export const OPACITY_60 = '99';
/** Canonical — 80% opacity suffix. */
export const OPACITY_80 = 'cc';

/** 0% opacity suffix — transparent (for animation keyframes). Endpoint, kept. */
export const OPACITY_0 = '00';

// ── Deprecated opacity tokens (prefer canonical six above) ─────────────────

/** @deprecated Off-grid; aliased to OPACITY_5. */
export const OPACITY_2 = OPACITY_5;
/** @deprecated Off-grid; aliased to OPACITY_5. */
export const OPACITY_3 = OPACITY_5;
/** @deprecated Off-grid; aliased to OPACITY_5. */
export const OPACITY_4 = OPACITY_5;
/** @deprecated Off-grid; aliased to OPACITY_5. */
export const OPACITY_6 = OPACITY_5;
/** @deprecated Prefer OPACITY_10. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_8 = '14';
/** @deprecated Prefer OPACITY_10. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_12 = '1f';
/** @deprecated Prefer OPACITY_20. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_15 = '26';
/** @deprecated Off-grid; aliased to OPACITY_20. */
export const OPACITY_22 = OPACITY_20;
/** @deprecated Prefer OPACITY_20. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_25 = '40';
/** @deprecated Prefer OPACITY_40. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_30 = '4d';
/** @deprecated Off-grid; aliased to OPACITY_40. */
export const OPACITY_37 = OPACITY_40;
/** @deprecated Prefer OPACITY_60. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_50 = '80';
/** @deprecated Off-grid; aliased to OPACITY_60. */
export const OPACITY_56 = OPACITY_60;
/** @deprecated Off-grid; aliased to OPACITY_80. */
export const OPACITY_87 = OPACITY_80;
/** @deprecated Prefer OPACITY_80. Value preserved to avoid visual drift; do not use in new code. */
export const OPACITY_90 = 'e6';

// ── Semantic border opacity tokens ────────────────────────────────────────

/** Default border opacity — visible but not heavy (20%) */
export const BORDER_DEFAULT = OPACITY_20;
/** Hover border opacity — stronger emphasis on interaction (37%) */
export const BORDER_HOVER = OPACITY_37;
/** Subtle border opacity — faint structural hints (10%) */
export const BORDER_SUBTLE = OPACITY_10;

// ── Glow radius presets ──────────────────────────────────────────────────

/** Small glow — subtle indicator halo */
export const GLOW_SM = '0 0 4px';
/** Medium glow — standard emphasis */
export const GLOW_MD = '0 0 8px';
/** Large glow — dramatic emphasis */
export const GLOW_LG = '0 0 16px';

// ── General opacity helper ────────────────────────────────────────────────

/**
 * Combine a hex color with an OPACITY_* suffix constant.
 *
 * @example withOpacity(STATUS_SUCCESS, OPACITY_8)  // '#4ade8014'
 * @example withOpacity(accent, OPACITY_20)          // '${accent}33'
 */
export function withOpacity(color: string, opacity: string): string {
  return `${color}${opacity}`;
}

// ── Semantic opacity helpers ───────────────────────────────────────────────

type OpacityIntensity = 0.05 | 0.08 | 0.12 | 0.20;

const INTENSITY_SUFFIX: Record<number, string> = {
  0.05: OPACITY_5,
  0.08: OPACITY_8,
  0.12: OPACITY_12,
  0.20: OPACITY_20,
};

/**
 * Return a hex color+opacity string at a standardized intensity.
 * Use for status backgrounds, badges, and card surfaces.
 *
 * @example statusBg(STATUS_ERROR, 0.08)  // '#f8717114'  — subtle error bg
 * @example statusBg(STATUS_SUCCESS, 0.20) // '#4ade8033' — stronger success bg
 */
export function statusBg(color: string, intensity: OpacityIntensity = 0.08): string {
  return `${color}${INTENSITY_SUFFIX[intensity] ?? OPACITY_8}`;
}

/**
 * Return a hex color+opacity string for borders at a standardized intensity.
 * Default is 20% — a visible but not heavy border.
 */
export function statusBorder(color: string, intensity: OpacityIntensity = 0.20): string {
  return `${color}${INTENSITY_SUFFIX[intensity] ?? OPACITY_20}`;
}

// ── Status glow helpers ────────────────────────────────────────────────────

/** Map a semantic status to its CSS glow custom property (for boxShadow). */
export function statusGlow(status: 'success' | 'info' | 'warning'): string {
  const map = { success: 'var(--glow-success)', info: 'var(--glow-info)', warning: 'var(--glow-warning)' } as const;
  return map[status];
}

// ── CLI terminal semantic colors (Tailwind class names) ─────────────────────

/** Semantic color classes for CLI terminal components — single source of truth. */
export const CLI_COLORS = {
  /** User input, prompt indicator, interactive links */
  prompt: 'text-blue-400',
  /** Done state, successful writes, checkmarks */
  success: 'text-green-400',
  /** Running state, edits, caution indicators */
  warning: 'text-yellow-400',
  /** Error state, abort actions, destructive */
  error: 'text-red-400',
  /** System messages, queue indicators */
  info: 'text-cyan-400',
  /** Assistant (Claude) icon in log entries */
  assistant: 'text-purple-400',
  /** User-authored message text in log entries */
  userText: 'text-blue-300',
  /** Unknown / fallback icon tint */
  fallback: 'text-gray-400',
  /** Build OK badge background tint */
  buildOkBg: 'bg-green-500/15',
  /** Info badge background tint (queue counters, system pills) */
  infoBadgeBg: 'bg-cyan-500/10',
  /** Info badge border tint (queue counters, system pills) */
  infoBadgeBorder: 'border-cyan-500/20',
} as const;

// ── Module / category accent colors ─────────────────────────────────────────

export const MODULE_COLORS = {
  setup: '#00ff88',
  core: '#3b82f6',
  content: '#f59e0b',
  systems: '#8b5cf6',
  evaluator: '#ef4444',
  'visual-gen': '#06b6d4',
} as const;

/** Per-tab accent colors — ensures visual diversity across tabs. */
export const TAB_ACCENT: Record<string, string> = {
  'arpg-combat': ACCENT_RED,
  'arpg-gas': ACCENT_PURPLE_BOLD,
  'arpg-enemy-ai': ACCENT_ORANGE,
  'arpg-inventory': ACCENT_EMERALD,
  'arpg-loot': STATUS_WARNING,
  'arpg-ui': ACCENT_PINK,
  'arpg-progression': ACCENT_CYAN,
  'arpg-world': ACCENT_EMERALD_DARK,
  'arpg-save': STATUS_INFO,
  'arpg-polish': ACCENT_ORANGE,
  'arpg-character': MODULE_COLORS.core,
  'arpg-animation': ACCENT_VIOLET,
} as const;

// ── Heatmap 5-stop scale ──────────────────────────────────────────────────

/** Step 1 (lowest) — deep red */
export const HEATMAP_STEP_1 = '#7f1d1d';
/** Step 2 — warm orange */
export const HEATMAP_STEP_2 = '#92400e';
/** Step 3 — neutral gray */
export const HEATMAP_STEP_3 = '#374151';
/** Step 4 — teal */
export const HEATMAP_STEP_4 = '#115e59';
/** Step 5 (highest) — deep emerald */
export const HEATMAP_STEP_5 = '#065f46';

const HEATMAP_STOPS = [HEATMAP_STEP_1, HEATMAP_STEP_2, HEATMAP_STEP_3, HEATMAP_STEP_4, HEATMAP_STEP_5];

/** Interpolate a 0-1 value to a 5-stop heatmap color. */
export function heatmapScale(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0) return HEATMAP_STOPS[0];
  if (clamped >= 1) return HEATMAP_STOPS[4];
  const segment = clamped * 4;
  const i = Math.floor(segment);
  const f = segment - i;
  const from = HEATMAP_STOPS[i];
  const to = HEATMAP_STOPS[Math.min(i + 1, 4)];
  const r1 = parseInt(from.slice(1, 3), 16), g1 = parseInt(from.slice(3, 5), 16), b1 = parseInt(from.slice(5, 7), 16);
  const r2 = parseInt(to.slice(1, 3), 16), g2 = parseInt(to.slice(3, 5), 16), b2 = parseInt(to.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

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

/**
 * Map a 0-100 build success-rate to a semantic color: ≥80 healthy (green),
 * ≥50 caution (amber), else failing (red). Keeps the build-history threshold
 * logic in one place so a metric value, its label, and the progress-bar fill
 * always draw the same band color instead of drifting between greens.
 */
export function successRateColor(rate: number): string {
  if (rate >= 80) return STATUS_SUCCESS;
  if (rate >= 50) return STATUS_WARNING;
  return STATUS_ERROR;
}

// ── Feature status colors ───────────────────────────────────────────────────

export const FEATURE_STATUS_COLORS = {
  implemented: STATUS_SUCCESS,
  improved: STATUS_IMPROVED,
  partial: STATUS_WARNING,
  missing: STATUS_ERROR,
  unknown: 'var(--text-muted)',
} as const;

/** Canvas-safe status colors (hex only, no CSS vars) for SVG/canvas rendering. */
export const PLAN_STATUS_COLORS: Record<string, string> = {
  implemented: STATUS_SUCCESS,
  improved: STATUS_IMPROVED,
  partial: STATUS_WARNING,
  missing: STATUS_ERROR,
  unknown: STATUS_NEUTRAL,
} as const;

/** Sector palette — 12 distinct dark hues for visual separation in dense layouts. */
export const SECTOR_PALETTE = [
  MODULE_COLORS.core,   ACCENT_RED,         ACCENT_GREEN,       STATUS_WARNING,
  STATUS_STALE,         ACCENT_CYAN,        HEATMAP_STEP_2,     STATUS_NEUTRAL,
  ACCENT_PURPLE_BOLD,   HEATMAP_STEP_5,     HEATMAP_STEP_1,     STATUS_INFO,
] as const;

// ── Insight / severity colors ───────────────────────────────────────────────

export const SEVERITY_COLORS = {
  critical: STATUS_ERROR,
  warning: STATUS_WARNING,
  info: STATUS_INFO,
  positive: STATUS_SUCCESS,
} as const;

// ── Unified severity tokens ────────────────────────────────────────────────
//
// Single source of truth for severity / gap coloring across the evaluator
// (Deep Eval, GDD Compliance, Codebase Archeologist, quality dashboards).
// Each token bundles the solid color with ready-to-use translucent bg/border
// fills, so a `critical` finding renders identically wherever it appears —
// instead of one view using #ef4444, another #f87171, and a third text-red-400.

export interface SeverityToken {
  /** Solid hex — text, icons, SVG/canvas fills, progress fills. */
  color: string;
  /** Translucent fill (color @ 8%) — badge / card backgrounds. */
  bg: string;
  /** Translucent border (color @ 20%). */
  border: string;
}

function makeSeverityToken(color: string): SeverityToken {
  return { color, bg: statusBg(color), border: statusBorder(color) };
}

/**
 * Canonical severity → visual token. Keys cover the four deep-eval finding
 * levels (critical/high/medium/low) plus the vocabulary other evaluator
 * domains use: `warning`/`info`/`positive` (insights, archeologist) and
 * `major`/`minor` (GDD gaps). Each alias shares the underlying status hue with
 * its canonical band, so equivalent severities stay visually consistent.
 */
export const SEVERITY_TOKENS = {
  critical: makeSeverityToken(STATUS_ERROR),   // red
  high: makeSeverityToken(STATUS_BLOCKER),     // orange
  medium: makeSeverityToken(STATUS_WARNING),   // amber
  low: makeSeverityToken(STATUS_INFO),         // blue
  // ── domain aliases (same hue as a canonical band) ──
  warning: makeSeverityToken(STATUS_WARNING),  // amber  → medium
  info: makeSeverityToken(STATUS_INFO),        // blue   → low
  positive: makeSeverityToken(STATUS_SUCCESS), // green
  major: makeSeverityToken(STATUS_BLOCKER),    // orange → high
  minor: makeSeverityToken(STATUS_INFO),       // blue   → low
} as const;

export type SeverityLevel = keyof typeof SEVERITY_TOKENS;

/**
 * Map a 0-100 health/compliance score to a severity-band token: high score =
 * healthy (green), low = critical (red). Used by GDD compliance scores and the
 * quality dashboards so the same number always maps to the same band color.
 */
export function scoreBandToken(score: number): SeverityToken {
  if (score >= 80) return SEVERITY_TOKENS.positive;
  if (score >= 60) return SEVERITY_TOKENS.medium;
  if (score >= 40) return SEVERITY_TOKENS.high;
  return SEVERITY_TOKENS.critical;
}

// ── Neutral base colors ──────────────────────────────────────────────────────

/** Slate-500 — subdued text, secondary labels */
export const STATUS_SUBDUED = '#64748b';

/** Slate-400 — muted fallback text/indicator */
export const STATUS_MUTED = '#94a3b8';

/** Slate-600 — locked, inaccessible, gated */
export const STATUS_LOCKED = '#475569';

/** Slate-700 — locked stroke/border */
export const STATUS_LOCKED_STROKE = '#334155';

// ── Heatmap legacy scale ────────────────────────────────────────────────

export const HEATMAP_HIGH = HEATMAP_STEP_5;
export const HEATMAP_MID = HEATMAP_STEP_3;
export const HEATMAP_LOW = HEATMAP_STEP_1;

// ── Quality heatmap surfaces (dark score-band cell fills) ──────────────────

/** Deep red — lowest-quality heatmap cell background. */
export const QUALITY_HEATMAP_LOW = HEATMAP_STEP_1; // '#7f1d1d'
/** Amber-900 — mid-quality heatmap cell background. */
export const QUALITY_HEATMAP_MID = '#78350f';
/** Green-900 — highest-quality heatmap cell background. */
export const QUALITY_HEATMAP_HIGH = '#14532d';

/** Dark slate — unfilled star / inactive rating indicator. */
export const RATING_EMPTY = '#2a2a4a';

// ── Item rarity colors ─────────────────────────────────────────────────

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export const RARITY_COLORS: Record<string, string> = {
  Common: STATUS_MUTED,
  Uncommon: ACCENT_EMERALD,
  Rare: STATUS_INFO,
  Epic: ACCENT_VIOLET,
  Legendary: STATUS_WARNING,
} as const satisfies Record<Rarity, string>;

export const RARITY_COLORS_LOWER: Record<string, string> = {
  common: STATUS_MUTED,
  uncommon: ACCENT_EMERALD,
  rare: STATUS_INFO,
  epic: ACCENT_VIOLET,
  legendary: STATUS_WARNING,
} as const;

// ── Affix category colors ─────────────────────────────────────────────────

export type AffixCategory = 'offensive' | 'defensive' | 'utility';

export const AFFIX_CATEGORY_COLORS: Record<AffixCategory, string> = {
  offensive: STATUS_ERROR,
  defensive: ACCENT_EMERALD,
  utility: ACCENT_CYAN,
} as const;

// ── Widget status ──────────────────────────────────────────────────────

export type WidgetStatus = 'ok' | 'warn' | 'error';

export function statusToColor(status: string): { bg: string; text: string; border: string; label: string } {
  const map: Record<string, { color: string; label: string }> = {
    ok: { color: STATUS_SUCCESS, label: 'OK' },
    warn: { color: STATUS_WARNING, label: 'WARN' },
    error: { color: STATUS_ERROR, label: 'FAIL' },
  };
  const { color, label } = map[status] ?? { color: STATUS_ERROR, label: 'FAIL' };
  return { bg: statusBg(color), text: color, border: statusBorder(color), label };
}

// ── Plan / DAG canvas surfaces ─────────────────────────────────────────────

/** Base surface for DAG node cards / cluster backgrounds. */
export const SURFACE_DAG_NODE = '#161626';
/** Ready-to-use DAG node fill at ~85% alpha (set as `backgroundColor`). */
export const SURFACE_DAG_NODE_FILL = `${SURFACE_DAG_NODE}d9`;

/** Base hover surface for DAG node cards. */
export const SURFACE_DAG_NODE_HOVER = '#1e1e2d';
/** Ready-to-use DAG node hover fill at ~95% alpha. */
export const SURFACE_DAG_NODE_HOVER_FILL = `${SURFACE_DAG_NODE_HOVER}f2`;

/** Filtered-out cluster background (heavily dimmed canvas zone). */
export const SURFACE_DAG_CLUSTER_DIM = '#0f0f19';
/** Ready-to-use filtered cluster fill at ~15% alpha. */
export const SURFACE_DAG_CLUSTER_DIM_FILL = `${SURFACE_DAG_CLUSTER_DIM}26`;

/** Minimap cluster fill base. */
export const SURFACE_MINIMAP_CLUSTER = '#323246';
/** Minimap cluster fill at 50% alpha. */
export const SURFACE_MINIMAP_CLUSTER_FILL = `${SURFACE_MINIMAP_CLUSTER}80`;

/** Neutral cool-gray border tint for DAG canvas overlays (rgba(100,100,130,…)). */
export const BORDER_DAG_NEUTRAL = '#646482';

// ── Roadmap checklist state surfaces ───────────────────────────────────────

/** Card background for items in partial-verification state (warm dark amber). */
export const STATE_PARTIAL_BG = '#1a1700';
/** Card border for items in partial-verification state. */
export const STATE_PARTIAL_BORDER = '#3a3000';

/** Card background for completed/done items (deep green). */
export const STATE_DONE_BG = '#0d1a0d';
/** Card border for completed/done items. */
export const STATE_DONE_BORDER = '#1a3a1a';

/** Card background for currently-active (CLI running) item (deep blue). */
export const STATE_ACTIVE_BG = '#111130';
/** Card border for currently-active item. */
export const STATE_ACTIVE_BORDER = '#2e2e6a';

/** Default border for unchecked checkbox controls (cool-gray indigo). */
export const CHECKBOX_BORDER = '#3e3e6a';
/** Hover border for unchecked checkbox controls. */
export const CHECKBOX_BORDER_HOVER = '#5e5e8a';

// ── Health score thresholds ─────────────────────────────────────────────────

/** Return a semantic color for a 0-100 health/progress score. */
export function healthColor(score: number): string {
  if (score >= 60) return STATUS_SUCCESS;
  if (score >= 30) return STATUS_WARNING;
  return STATUS_ERROR;
}
