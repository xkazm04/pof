/**
 * Tiny observable state container — the shared subscribe/notify/getState
 * primitive used by the bridge singletons (pof-bridge & ue5-bridge connection
 * managers, ue5-bridge live-state client).
 *
 * Each of those hand-rolled the same trio: a `Set` of subscribers, a
 * `notifySubscribers()` that iterates with a per-handler try/catch, and a
 * `getState()` that returns a defensive copy. This centralizes that into one
 * consistent, tested notification path.
 *
 * Compose it (don't inherit): hold a `createStateEmitter<T>()` as a private
 * field, expose `getState`/`onStateChange` by delegating, and drive updates
 * through `setState`. Use `peek()` for the owner's own hot internal reads to
 * avoid clone churn.
 */

import { logger } from '@/lib/logger';

export interface StateEmitter<T> {
  /** Defensive copy of the current state — safe to hand to subscribers/callers. */
  getState(): T;
  /**
   * Live (un-cloned) reference to the current state, for the owner's own
   * internal reads. Treat as read-only — never mutate it in place.
   */
  peek(): T;
  /** Shallow-merge `partial` into the state, then notify all subscribers. */
  setState(partial: Partial<T>): void;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(handler: (state: T) => void): () => void;
  /** Number of active subscribers (diagnostics / tests). */
  readonly size: number;
}

export interface StateEmitterOptions<T> {
  /** Initial state. */
  initial: T;
  /** Prefix used in subscriber-error warnings, e.g. `'[PoF-CM]'`. */
  label: string;
  /**
   * Produce a defensive copy of the state for `getState()` and notifications.
   * Defaults to a shallow clone (`{ ...state }`); override when the state holds
   * nested mutable structures (e.g. a `Map`) that must be cloned too.
   */
  clone?: (state: T) => T;
}

export function createStateEmitter<T extends object>(
  options: StateEmitterOptions<T>,
): StateEmitter<T> {
  const { label, clone = (s: T) => ({ ...s }) } = options;
  let state = options.initial;
  const subscribers = new Set<(state: T) => void>();

  function getState(): T {
    return clone(state);
  }

  function notify(): void {
    const snapshot = getState();
    for (const handler of subscribers) {
      try {
        handler(snapshot);
      } catch (e) {
        logger.warn(`${label} Subscriber error:`, e);
      }
    }
  }

  function setState(partial: Partial<T>): void {
    state = { ...state, ...partial };
    notify();
  }

  function subscribe(handler: (state: T) => void): () => void {
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }

  return {
    getState,
    peek: () => state,
    setState,
    subscribe,
    get size() {
      return subscribers.size;
    },
  };
}
