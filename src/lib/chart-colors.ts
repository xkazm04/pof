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

// ── Opacity helpers — append to any hex color ───────────────────────────────

/** 0% opacity suffix — transparent (for animation keyframes) */
export const OPACITY_0 = '00';
/** 2% opacity suffix — barely-visible grid lines, ultra-subtle fills */
export const OPACITY_2 = '05';
/** 3% opacity suffix — faint grid lines, minimal backgrounds */
export const OPACITY_3 = '08';
/** 4% opacity suffix — very subtle grid lines and fills */
export const OPACITY_4 = '0a';
/** 5% opacity suffix */
export const OPACITY_5 = '0d';
/** 6% opacity suffix — standard grid lines, chart backgrounds */
export const OPACITY_6 = '0f';
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
/** 22% opacity suffix */
export const OPACITY_22 = '38';
/** 25% opacity suffix */
export const OPACITY_25 = '40';
/** 30% opacity suffix */
export const OPACITY_30 = '4d';
/** 37% opacity suffix */
export const OPACITY_37 = '60';
/** 40% opacity suffix — medium emphasis fills and strokes */
export const OPACITY_40 = '66';
/** 50% opacity suffix */
export const OPACITY_50 = '80';
/** 56% opacity suffix */
export const OPACITY_56 = '90';
/** 60% opacity suffix */
export const OPACITY_60 = '99';
/** 80% opacity suffix */
export const OPACITY_80 = 'cc';
/** 87% opacity suffix */
export const OPACITY_87 = 'dd';
/** 90% opacity suffix */
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

// ── Health score thresholds ─────────────────────────────────────────────────

/** Return a semantic color for a 0-100 health/progress score. */
export function healthColor(score: number): string {
  if (score >= 60) return STATUS_SUCCESS;
  if (score >= 30) return STATUS_WARNING;
  return STATUS_ERROR;
}
