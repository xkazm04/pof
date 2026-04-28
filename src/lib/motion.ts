/**
 * Single source of truth for motion timing.
 *
 * Canonical taxonomy: DURATION + EASE_OUT/EASE_FILL + SPRING + STAGGER.
 * Use these directly for new code. MOTION_CONFIG and ANIMATION_PRESETS are
 * kept as @deprecated aliases that point at the canonical tokens — do not
 * extend them; migrate call sites onto the canonical names when touched.
 */

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

/* ── Deprecated aliases (do not extend) ──────────────────────────────────── */

/**
 * @deprecated Prefer canonical tokens directly:
 * `standard` → `{ duration: DURATION.base, ease: EASE_OUT }`,
 * `spring`   → `SPRING.snappy`,
 * `stagger`  → `STAGGER.fast`,
 * `micro`    → `{ duration: DURATION.fast }`.
 */
export const MOTION_CONFIG = {
  /** @deprecated Use `{ duration: DURATION.base, ease: EASE_OUT }`. */
  standard: { duration: DURATION.base, ease: EASE_OUT },
  /** @deprecated Use `SPRING.snappy`. */
  spring: SPRING.snappy,
  /** @deprecated Use `STAGGER.fast`. */
  stagger: STAGGER.fast,
  /** @deprecated Use `{ duration: DURATION.fast }`. */
  micro: { duration: DURATION.fast },
} as const;

/**
 * @deprecated Prefer canonical tokens directly:
 * `entrance` → `{ duration: DURATION.base, ease: EASE_OUT }`,
 * `fill`     → `{ duration: DURATION.slow, ease: EASE_FILL }`,
 * `spring`   → `SPRING.snappy`,
 * `stagger`  → `STAGGER.fast`.
 */
export const ANIMATION_PRESETS = {
  /** @deprecated Use `{ duration: DURATION.base, ease: EASE_OUT }`. */
  entrance: { duration: DURATION.base, ease: EASE_OUT },
  /** @deprecated Use `{ duration: DURATION.slow, ease: EASE_FILL }`. */
  fill: { duration: DURATION.slow, ease: EASE_FILL },
  /** @deprecated Use `SPRING.snappy`. */
  spring: SPRING.snappy,
  /** @deprecated Use `STAGGER.fast`. The `slow` 0.1s is preserved for parity with old call sites; new code should use `STAGGER.fast`. */
  stagger: { default: STAGGER.fast, slow: 0.1 },
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
