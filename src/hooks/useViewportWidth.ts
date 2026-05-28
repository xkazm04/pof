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
