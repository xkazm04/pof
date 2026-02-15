/** Unified animation timing — matches CSS custom properties in globals.css */

export const DURATION = {
  fast: 0.12,   // micro-interactions: hovers, toggles, tooltips
  base: 0.22,   // standard transitions: panels, dropdowns, fades
  slow: 0.45,   // dramatic emphasis: progress fills, reveals, stagger
} as const;

/** Entry easing — cubic-bezier(0.16, 1, 0.3, 1) */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Progress/fill easing — cubic-bezier(0.4, 0, 0.2, 1) */
export const EASE_FILL = [0.4, 0, 0.2, 1] as const;
