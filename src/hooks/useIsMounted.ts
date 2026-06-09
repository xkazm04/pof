'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable getter reporting whether the calling component is still mounted.
 *
 * Use it to guard a `setState` that runs after an `await`, so updates resolving
 * after unmount are skipped (avoids React's "state update on an unmounted
 * component" footgun). The returned function identity is stable across renders,
 * so it's safe to omit from `useCallback` / `useEffect` dependency arrays.
 *
 * Re-arming `mountedRef` on mount (not just on first render) keeps it correct
 * under React StrictMode's mount → unmount → remount double-invoke.
 *
 * @example
 * const isMounted = useIsMounted();
 * const data = await apiFetch('/api/thing');
 * if (isMounted()) setData(data);
 */
export function useIsMounted(): () => boolean {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return useCallback(() => mountedRef.current, []);
}
