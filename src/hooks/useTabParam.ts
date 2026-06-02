'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Persist an active sub-tab in a URL query param so it survives refresh, back/
 * forward navigation, and link sharing — a drop-in replacement for
 * `useState<TabId>(default)` in the authoring module shells.
 *
 * Uses the History API (`replaceState`) directly rather than next/navigation's
 * `useSearchParams`, which would force the whole route into dynamic rendering
 * (or require a Suspense boundary) and trip up `next build`. Reading happens on
 * mount to avoid an SSR hydration mismatch; an unknown/stale value falls back to
 * `defaultValue`, so each module can safely namespace its own param key.
 */
export function useTabParam<T extends string>(
  paramKey: string,
  defaultValue: T,
  validValues: readonly T[],
): [T, (value: T) => void] {
  const [tab, setTabState] = useState<T>(defaultValue);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(paramKey);
    if (fromUrl && (validValues as readonly string[]).includes(fromUrl)) {
      setTabState(fromUrl as T);
    }
    // Read the deep-linked tab once on mount; validValues/defaultValue are
    // captured from the initial render and intentionally not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  const setTab = useCallback((value: T) => {
    setTabState(value);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set(paramKey, value);
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }, [paramKey]);

  return [tab, setTab];
}
