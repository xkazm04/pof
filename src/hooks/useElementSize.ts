'use client';

import { useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Measures an element's rendered size via a single `ResizeObserver`, returning the
 * `[ref, size]` tuple to attach and read. Until a real (non-zero) measurement
 * arrives — during SSR, the first client paint, or jsdom (no `ResizeObserver`) —
 * `fallback` is returned so callers always have usable dimensions.
 *
 * Mirrors {@link useViewportWidth}: state is only set inside the observer callback
 * (never synchronously in the effect body), keeping clear of the
 * `react-hooks/set-state-in-effect` rule, and zero-size frames are ignored so a
 * detached/hidden node never collapses the value.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(
  fallback: ElementSize = { width: 0, height: 0 },
): readonly [React.RefObject<T | null>, ElementSize] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
