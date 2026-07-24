'use client';

import { useSyncExternalStore } from 'react';

/**
 * Matches touch-first devices: no hover capability AND a coarse (finger) primary
 * pointer. This is the correct gate for "is this a phone/tablet?" — it is *not*
 * the same as a narrow viewport (a small desktop window still has a fine pointer
 * and hover), so use it for interaction-capability decisions (drag editors,
 * hover-reveal fallbacks) rather than layout breakpoints.
 */
const COARSE_QUERY = '(hover: none) and (pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(COARSE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COARSE_QUERY).matches;
}

// Desktop-first on the server / in jsdom (mirrors the WIDE_FALLBACK contract):
// coarse-pointer accommodations never render during SSR, avoiding hydration drift.
function getServerSnapshot(): boolean {
  return false;
}

/** `true` on touch-first (no-hover, coarse-pointer) devices; `false` on desktop. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
