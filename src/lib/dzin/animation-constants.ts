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
