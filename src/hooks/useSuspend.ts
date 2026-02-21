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
 *   const progress = useSuspendableSelector(useModuleStore, (s) => s.checklistProgress);
 *
 * Under the hood this works by ignoring store subscription notifications while
 * suspended and returning the last-known snapshot. On resume, the next render
 * picks up the current store state because React will re-render the component
 * (the parent's display toggle triggers a re-render).
 */
export function useSuspendableSelector<S, T>(
  useStore: {
    getState: () => S;
    subscribe: (listener: () => void) => () => void;
  },
  selector: (state: S) => T,
): T {
  const suspended = useContext(SuspendContext);
  const frozenRef = useRef<T | undefined>(undefined);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // When becoming active, clear the frozen value so the next getSnapshot reads fresh state
  const prevSuspendedRef = useRef(suspended);
  if (prevSuspendedRef.current && !suspended) {
    frozenRef.current = undefined;
  }
  prevSuspendedRef.current = suspended;

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
    if (suspended && frozenRef.current !== undefined) {
      return frozenRef.current;
    }
    const value = selectorRef.current(useStore.getState());
    frozenRef.current = value;
    return value;
  }, [useStore, suspended]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (suspended) return;
    return effect();
    // Include suspended in deps so effect re-runs on resume
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspended, ...deps]);
}
