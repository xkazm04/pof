'use client';

import { createContext, useContext, useRef, useSyncExternalStore, useCallback, useEffect } from 'react';

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * SuspendContext — signals whether a module tree is suspended (hidden in LRU).
 *
 * When `true`, the subtree should:
 * - Freeze store subscriptions (skip re-renders on state changes)
 * - Pause timers and periodic side effects
 * - Skip API polling
 *
 * When switching back to `false`, subscriptions re-sync with current state.
 */
export const SuspendContext = createContext<boolean>(false);

/**
 * Returns whether the current component tree is suspended (hidden in LRU cache).
 */
export function useIsSuspended(): boolean {
  return useContext(SuspendContext);
}

// ── Suspendable store selector ──────────────────────────────────────────────

/**
 * Drop-in replacement for zustand's `useStore(selector)` that freezes the
 * return value while the module is suspended. When the module becomes active
 * again, the selector re-evaluates against the latest store state, picking up
 * any changes that happened while suspended.
 *
 * Usage:
 *   const snapshot = useSuspendableSelector(useUE5BridgeStore, (s) => s.liveSnapshot);
 *
 * Use it for a slice written many times a second or on a poll and read only to
 * display. Do not use it for a value a handler sends somewhere (host, port, an id):
 * a frozen read must never reach a write path. Selected actions stay callable, but
 * they gain nothing from it. See docs/architecture/runtime-patterns.md.
 *
 * While suspended, a selector closing over a changed prop still answers from the
 * frozen value; it re-reads on resume.
 */
export function useSuspendableSelector<S, T>(
  useStore: {
    getState: () => S;
    subscribe: (listener: () => void) => () => void;
  },
  selector: (state: S) => T,
): T {
  const suspended = useContext(SuspendContext);
  // Boxed: a selected `undefined` is a value to freeze, not the absence of one.
  const frozenRef = useRef<{ value: T } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (suspended) {
        // No-op subscription — store changes won't trigger re-renders
        return () => {};
      }
      return useStore.subscribe(onStoreChange);
    },
    [useStore, suspended],
  );

  const getSnapshot = useCallback(() => {
    if (suspended && frozenRef.current) {
      return frozenRef.current.value;
    }
    const value = selector(useStore.getState());
    frozenRef.current = { value };
    return value;
  }, [useStore, suspended, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Suspendable effect ──────────────────────────────────────────────────────

/**
 * Like `useEffect`, but the effect only runs when the module is NOT suspended.
 * When the module becomes suspended, the cleanup function is called.
 * When it becomes active again, the effect re-runs.
 *
 * Use this for timers, polling, and other ongoing side effects that should
 * pause when the module is hidden.
 */
export function useSuspendableEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
): void {
  const suspended = useContext(SuspendContext);

  useEffect(() => {
    if (suspended) return;
    return effect();
    // Include suspended in deps so effect re-runs on resume
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspended, ...deps]);
}
