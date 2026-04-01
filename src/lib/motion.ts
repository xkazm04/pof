/** Unified animation timing — matches CSS custom properties in globals.css */

export const DURATION = {
  fast: 0.12,   // micro-interactions: hovers, toggles, tooltips
  base: 0.22,   // standard transitions: panels, dropdowns, fades
  slow: 0.45,   // dramatic emphasis: progress fills, reveals, stagger
  /** Shared easing curve — fast entrance, smooth deceleration. */
  ease: [0.16, 1, 0.3, 1] as readonly [number, number, number, number],
  /** Default stagger increment for list animations. */
  staggerChildren: 0.04,
} as const;

/** Entry easing — cubic-bezier(0.16, 1, 0.3, 1) */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Progress/fill easing — cubic-bezier(0.4, 0, 0.2, 1) */
export const EASE_FILL = [0.4, 0, 0.2, 1] as const;

/** Named spring presets for Framer Motion physics-based transitions. */
export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 300, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
} as const;

/** Stagger timing presets (seconds). */
export const STAGGER = {
  fast: 0.04,
} as const;

/**
 * Unified motion config for consistent animation feel across Character Design panels.
 * Use these presets instead of inline transition objects.
 */
export const MOTION_CONFIG = {
  /** Standard tween: 0.3s with custom ease-out curve */
  standard: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  /** Spring for toggles, chevrons, interactive controls */
  spring: { type: 'spring' as const, stiffness: 400, damping: 30 },
  /** Per-item stagger delay (multiply by index) */
  stagger: 0.06,
  /** Quick micro-interaction (tooltips, chevron flips) */
  micro: { duration: 0.15 },
} as const;

/* ── Centralized Animation Presets ────────────────────────────────────────── */

/**
 * Four canonical animation presets used across all unique-tab components.
 * Import these instead of defining inline transition objects.
 *
 * - `entrance` — standard appear/reveal (panels, tooltips, sections)
 * - `fill`     — progress bars, gauge fills, waterfall bars
 * - `spring`   — interactive physics (toggles, synergy pop-in, tooltip scale)
 * - `stagger`  — per-item delays for lists/grids
 */
export const ANIMATION_PRESETS = {
  entrance: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  fill:     { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  spring:   { type: 'spring' as const, stiffness: 300, damping: 20 },
  stagger:  { default: 0.05, slow: 0.1 },
} as const;

/** No-op transition for reduced-motion contexts. */
const REDUCED_TRANSITION = { duration: 0 } as const;

/**
 * Returns the given transition when motion is allowed, or an instant
 * (duration:0) transition when the user prefers reduced motion.
 */
export function motionSafe<T extends Record<string, unknown>>(
  transition: T,
  prefersReduced: boolean | null,
): T | typeof REDUCED_TRANSITION {
  return prefersReduced ? REDUCED_TRANSITION : transition;
}
