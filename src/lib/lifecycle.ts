/**
 * Lifecycle<T> protocol — unified resource management pattern.
 *
 * Extracts the common birth-live-death lifecycle from six resource patterns:
 *   1. CLI sessions (EventSource + heartbeat + stuck detection)
 *   2. File watchers (EventSource, controlled-monopoly)
 *   3. EventSource SSE connections (stream route)
 *   4. Event bus subscriptions (Zustand → bus bridge)
 *   5. Activity feed bridge (one-time-init guard)
 *   6. Module cache auto-save (debounce timer)
 *
 * Each Lifecycle<T> instance exposes:
 *   - init(): start the resource
 *   - isActive(): check if running
 *   - dispose(): guaranteed cleanup
 *
 * The `useLifecycle()` React hook guarantees cleanup on unmount and
 * handles the controlled-monopoly pattern (teardown-before-switch).
 */

// ─── Core protocol ────────────────────────────────────────────────────────────

export interface Lifecycle<T = void> {
  /** Start the resource. Returns the resource handle (or void). */
  init(): T;
  /** Whether the resource is currently active. */
  isActive(): boolean;
  /** Tear down the resource. Safe to call multiple times. */
  dispose(): void;
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Create a Lifecycle that wraps a single disposable resource.
 * Implements controlled-monopoly: calling init() again disposes the previous.
 */
export function createLifecycle<T>(
  factory: () => T,
  teardown: (resource: T) => void,
): Lifecycle<T> {
  let resource: T | null = null;
  let active = false;

  return {
    init() {
      if (active && resource !== null) {
        teardown(resource);
      }
      resource = factory();
      active = true;
      return resource;
    },
    isActive() {
      return active;
    },
    dispose() {
      if (active && resource !== null) {
        teardown(resource);
        resource = null;
      }
      active = false;
    },
  };
}

/**
 * Create a Lifecycle for a set of unsubscribe functions (event subscriptions).
 * Calling init() collects subscriptions; dispose() unsubscribes all.
 */
export function createSubscriptionLifecycle(
  subscribe: () => (() => void)[],
): Lifecycle<void> {
  let unsubs: (() => void)[] = [];
  let active = false;

  return {
    init() {
      if (active) this.dispose();
      unsubs = subscribe();
      active = true;
    },
    isActive() {
      return active;
    },
    dispose() {
      for (const unsub of unsubs) unsub();
      unsubs = [];
      active = false;
    },
  };
}

/**
 * Create a Lifecycle that guards one-time initialization.
 * Re-calling init() is a no-op while active. Call dispose() first to re-init.
 */
export function createGuardedLifecycle(
  setup: () => () => void,
): Lifecycle<void> {
  let cleanup: (() => void) | null = null;
  let active = false;

  return {
    init() {
      if (active) return;
      cleanup = setup();
      active = true;
    },
    isActive() {
      return active;
    },
    dispose() {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
      active = false;
    },
  };
}

/**
 * Create a Lifecycle wrapping a debounced timer (e.g., auto-save).
 * init() starts/restarts the timer. dispose() cancels it.
 */
export function createTimerLifecycle(
  callback: () => void,
  delayMs: number,
): Lifecycle<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  return {
    init() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        active = false;
        callback();
      }, delayMs);
      active = true;
    },
    isActive() {
      return active;
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      active = false;
    },
  };
}

// ─── Composition ──────────────────────────────────────────────────────────────

/**
 * Compose multiple Lifecycle instances into one.
 * init() calls all in order; dispose() calls all in reverse order.
 */
export function composeLifecycles(...lifecycles: Lifecycle[]): Lifecycle<void> {
  return {
    init() {
      for (const lc of lifecycles) lc.init();
    },
    isActive() {
      return lifecycles.some((lc) => lc.isActive());
    },
    dispose() {
      for (let i = lifecycles.length - 1; i >= 0; i--) {
        lifecycles[i].dispose();
      }
    },
  };
}
