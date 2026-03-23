/**
 * Shared framer-motion animation variants for consistent UI motion.
 * Import these in components instead of defining one-off variants.
 */
import type { Variants, Transition } from 'framer-motion';

/** Standard easing curve — spring-like deceleration */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Standard durations */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  dramatic: 0.8,
} as const;

/** Fade up — opacity 0→1, y offset 20→0 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Fade in — simple opacity */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Scale in — opacity + scale from 0.95 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Slide in from left */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Slide in from right */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Stagger container — delays children by configurable amount */
export function staggerContainer(staggerDelay = 0.06): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: staggerDelay },
    },
  };
}

/** Standard transition presets */
export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE_OUT } satisfies Transition,
  base: { duration: DURATION.base, ease: EASE_OUT } satisfies Transition,
  slow: { duration: DURATION.slow, ease: EASE_OUT } satisfies Transition,
  spring: { type: 'spring', stiffness: 400, damping: 30 } satisfies Transition,
} as const;
