/**
 * Dzin-specific animation timing constants.
 * Separate from PoF's UI_TIMEOUTS — these control layout engine transitions.
 */

/** Timing durations in seconds for framer-motion transitions. */
export const DZIN_TIMING = {
  /** Layout template transition (300ms). */
  LAYOUT: 0.3,
  /** Density crossfade total (200ms — split as 0.1 out + 0.1 in). */
  DENSITY: 0.2,
  /** Cross-panel highlight transition (150ms). */
  HIGHLIGHT: 0.15,
} as const;

/** Material Design standard easing curve. */
export const LAYOUT_EASE = [0.4, 0, 0.2, 1] as const;

/** Decelerate-in: elements arriving / expanding feel welcoming. */
export const EASE_ENTER = [0, 0, 0.2, 1] as const;

/** Accelerate-out: elements leaving / collapsing feel decisive. */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;

/** Spring config for resize feedback (framer-motion spring type). */
export const EASE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 25 };

/* ── Convenience type for cubic-bezier tuples ────────────────────────── */

export type CubicBezier = [number, number, number, number];

/* ── Directional transition presets ──────────────────────────────────── */

/** Transition for panels/elements entering the viewport. */
export const TRANSITION_ENTER = {
  duration: DZIN_TIMING.LAYOUT,
  ease: EASE_ENTER as CubicBezier,
};

/** Transition for panels/elements exiting the viewport. */
export const TRANSITION_EXIT = {
  duration: DZIN_TIMING.LAYOUT,
  ease: EASE_EXIT as CubicBezier,
};

/* ── Canonical density breakpoints ────────────────────────────────────── */

/**
 * Pixel-value threshold for a single density level (no description — those
 * stay per-panel since they are LLM-readable and panel-specific).
 */
export interface DensityThreshold {
  readonly minWidth: number;
  readonly minHeight: number;
}

/**
 * A full set of density thresholds for all three density levels.
 */
export type DensityPreset = Readonly<Record<'full' | 'compact' | 'micro', DensityThreshold>>;

/**
 * Single source of truth for density breakpoints across the dzin panel system.
 *
 * - **fallback** — Used by the layout engine when a panel has no densityModes.
 * - **standard** — Most panels (~400px wide at full density).
 * - **wide** — Timeline / horizontal panels (~500px wide at full density).
 *
 * Panel registrations reference these via spread + description, e.g.:
 * ```ts
 * densityModes: {
 *   micro:   { ...DENSITY_CONFIG.standard.micro,   description: '…' },
 *   compact: { ...DENSITY_CONFIG.standard.compact,  description: '…' },
 *   full:    { ...DENSITY_CONFIG.standard.full,     description: '…' },
 * }
 * ```
 */
export const DENSITY_CONFIG = {
  /** Fallback thresholds when a panel has no explicit densityModes config. */
  fallback: {
    full:    { minWidth: 400, minHeight: 300 },
    compact: { minWidth: 180, minHeight: 120 },
    micro:   { minWidth: 60,  minHeight: 40 },
  },
  /** Standard panels: moderate width, balanced height. */
  standard: {
    full:    { minWidth: 400, minHeight: 300 },
    compact: { minWidth: 200, minHeight: 160 },
    micro:   { minWidth: 80,  minHeight: 60 },
  },
  /** Wide / timeline panels: extra width, compact height. */
  wide: {
    full:    { minWidth: 500, minHeight: 120 },
    compact: { minWidth: 240, minHeight: 80 },
    micro:   { minWidth: 80,  minHeight: 60 },
  },
} as const satisfies Record<string, DensityPreset>;

/** Density levels ordered from highest to lowest (used by layout engine). */
export const DENSITY_ORDER: readonly ('full' | 'compact' | 'micro')[] = ['full', 'compact', 'micro'];

/* ── Spacing constants per density level ───────────────────────────────── */

/**
 * Standardized spacing tokens for dzin panels.
 * Based on a 4px rhythm (Tailwind's spacing scale).
 *
 * Each density level defines:
 * - `wrapper`  — outer wrapper class (gap + padding)
 * - `card`     — card-level padding
 * - `gap`      — grid/flex gap between sibling cards
 * - `divider`  — top-padding after a border-t divider
 * - `sectionMb` — margin-bottom after a section label
 * - `contentMt` — margin-top for content below a label/header
 */
export const DZIN_SPACING = {
  /** Micro: icon + single metric, tightest layout. */
  micro: {
    wrapper: 'flex flex-col items-center justify-center gap-1 p-2',
  },
  /** Compact: scannable list, moderate breathing room. */
  compact: {
    wrapper: 'space-y-1.5 p-2',
    divider: 'pt-1.5',
  },
  /** Full: rich cards, generous whitespace. */
  full: {
    wrapper: 'space-y-2.5',
    card: 'p-3',
    gap: 'gap-2.5',
    gridGap: 'gap-3',
    sectionMb: 'mb-2.5',
    contentMt: 'mt-2.5',
    pipelineMt: 'mt-3',
  },
} as const;
