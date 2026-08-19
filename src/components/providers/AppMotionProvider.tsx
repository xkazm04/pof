'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * App-wide framer-motion reduced-motion policy.
 *
 * `globals.css` already zeroes CSS `animation-duration` / `transition-duration`
 * under `@media (prefers-reduced-motion: reduce)`, but framer-motion drives
 * styles from JavaScript — it never reads that media query. Its own default is
 * `reducedMotion: "never"` (see `MotionConfigContext`'s default value), so
 * without this provider every `motion.*` element in the app *explicitly ignores*
 * the operating-system preference.
 *
 * `reducedMotion="user"` makes each visual element read `prefers-reduced-motion`
 * once at mount and, when it is set, run every *positional* value instantly
 * (`{ type: false }`) instead of animating it. Framer's `positionalKeys` set is
 * `width | height | top | left | right | bottom` plus the transform props
 * (`x`, `y`, `scale*`, `rotate*`, `skew*`, `translate*`, `perspective`), which
 * also covers `layoutId` / `layout` animations because those are executed as
 * transforms. A looping `scale`/`x`/`rotate` keyframe animation therefore snaps
 * to its final keyframe and stops, app-wide, for free.
 *
 * What this provider deliberately does **not** cover: non-positional properties
 * — `opacity`, `backgroundColor`, `borderColor`, `boxShadow`, `strokeDashoffset`,
 * SVG geometry attributes like `r` — keep animating, by framer's design (a
 * cross-fade is not vestibular-triggering). That is the right default for a
 * one-shot fade, but a `repeat: Infinity` pulse on those properties is still a
 * perpetually-moving element. Those loops must opt in explicitly via
 * `motionSafe(transition, useReducedMotion())` from `@/lib/motion`; the guard in
 * `src/__tests__/a11y/motion-loop-guard.test.ts` enforces that they do.
 */
export function AppMotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
