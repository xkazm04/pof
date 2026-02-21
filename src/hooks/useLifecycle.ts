'use client';

import { useEffect, useRef } from 'react';
import type { Lifecycle } from '@/lib/lifecycle';

/**
 * React hook that manages a Lifecycle<T> instance.
 *
 * Guarantees:
 * - init() is called when deps change (or on mount if no deps)
 * - dispose() is called before re-init (controlled-monopoly / teardown-before-switch)
 * - dispose() is called on unmount
 *
 * @param factory  Function that creates a Lifecycle instance. Called on every render
 *                 cycle where deps change. The factory should be stable or deps-driven.
 * @param deps     Dependency array (same semantics as useEffect).
 *                 When deps change, the previous lifecycle is disposed and a new one is init'd.
 */
export function useLifecycle<T = void>(
  factory: () => Lifecycle<T>,
  deps: React.DependencyList,
): void {
  const lifecycleRef = useRef<Lifecycle<T> | null>(null);

  useEffect(() => {
    const lifecycle = factory();
    lifecycleRef.current = lifecycle;
    lifecycle.init();

    return () => {
      lifecycle.dispose();
      lifecycleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook variant for lifecycles that should only init once (guarded).
 * Safe for React StrictMode (dispose + re-init on double-mount).
 */
export function useGuardedLifecycle(
  factory: () => Lifecycle<void>,
): void {
  const lifecycleRef = useRef<Lifecycle<void> | null>(null);

  useEffect(() => {
    const lifecycle = factory();
    lifecycleRef.current = lifecycle;
    lifecycle.init();

    return () => {
      lifecycle.dispose();
      lifecycleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
