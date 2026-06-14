'use client';

import { useState, useEffect } from 'react';

/**
 * Desktop-first fallback width. Used for SSR, for the first client paint (before
 * a real measurement arrives), and in jsdom — where `ResizeObserver` is absent —
 * so server and initial client renders agree (no hydration mismatch) and tests
 * see the wide layout by default. A real browser corrects this within a frame.
 */
export const WIDE_FALLBACK_WIDTH = 1440;

/**
 * Tracks the viewport width via a single `ResizeObserver` on `documentElement`
 * (which fires once on `observe()` with the current size, then on every resize).
 * Returns {@link WIDE_FALLBACK_WIDTH} until the first measurement, so the layout
 * starts wide and collapses only once a narrow viewport is confirmed.
 *
 * Mirrors `useLayout`'s observer pattern: state is only set inside the observer
 * callback (never synchronously in the effect body), keeping it clear of the
 * `react-hooks/set-state-in-effect` rule.
 *
 * NOTE: this re-renders the consumer on *every* resize pixel. Almost every
 * consumer only cares whether the width is on one side of a breakpoint — prefer
 * {@link useViewportAtLeast}, which re-renders only when that threshold flips.
 * Reach for the raw width only when a component genuinely needs the exact pixels.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(WIDE_FALLBACK_WIDTH);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(window.innerWidth));
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return width;
}

/**
 * Threshold-aware viewport hook: returns `true` while the viewport width is at
 * or above `breakpoint`, `false` below it. Defaults to `true` until the first
 * measurement (the desktop-first {@link WIDE_FALLBACK_WIDTH} contract), so the
 * layout starts wide and collapses only once a narrow viewport is confirmed.
 *
 * Unlike {@link useViewportWidth}, state is the *derived boolean*, not the raw
 * width: the observer recomputes `width >= breakpoint` on every resize event but
 * only calls `setState` when that boolean actually changes. A resize drag that
 * never crosses `breakpoint` therefore causes zero re-renders of the consumer —
 * the common responsive case (column count / drawer-vs-inline toggles) avoids
 * the per-pixel re-render storm entirely.
 *
 * Mirrors {@link useViewportWidth}'s observer/SSR semantics: same fallback,
 * state set only inside the observer callback.
 */
export function useViewportAtLeast(breakpoint: number): boolean {
  const [atLeast, setAtLeast] = useState(WIDE_FALLBACK_WIDTH >= breakpoint);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = window.innerWidth >= breakpoint;
      // Only re-render when the threshold flips; intermediate widths are ignored.
      setAtLeast((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [breakpoint]);

  return atLeast;
}
