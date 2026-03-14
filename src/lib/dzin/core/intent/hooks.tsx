import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { Intent, IntentBus, IntentResult } from './types';

// ---------------------------------------------------------------------------
// Intent Context
// ---------------------------------------------------------------------------

const IntentContext = createContext<IntentBus | null>(null);

// ---------------------------------------------------------------------------
// IntentProvider
// ---------------------------------------------------------------------------

/**
 * Provides an IntentBus to the React tree. Wrap your app root (or workspace
 * subtree) with this provider so `useIntent()` hooks can dispatch intents.
 */
export function IntentProvider({
  bus,
  children,
}: {
  bus: IntentBus;
  children: ReactNode;
}): ReactNode {
  return <IntentContext.Provider value={bus}>{children}</IntentContext.Provider>;
}

// ---------------------------------------------------------------------------
// useIntent Hook
// ---------------------------------------------------------------------------

/**
 * React hook that provides access to the IntentBus dispatch function and
 * real-time pending state via useSyncExternalStore.
 *
 * Must be used within an `IntentProvider`.
 *
 * @returns dispatch function, isResolving boolean, and pendingCount number.
 * @throws Error if used outside IntentProvider.
 */
export function useIntent(): {
  dispatch: (intent: Intent) => IntentResult;
  isResolving: boolean;
  pendingCount: number;
} {
  const bus = useContext(IntentContext);
  if (!bus) {
    throw new Error('useIntent must be used within IntentProvider');
  }

  // Subscribe wraps bus.subscribe -- bus expects (event) => void but
  // useSyncExternalStore expects subscribe(onStoreChange: () => void).
  // We bridge by calling onStoreChange (no-arg) when bus fires any event.
  const subscribe = useCallback(
    (onStoreChange: () => void) => bus.subscribe(() => onStoreChange()),
    [bus],
  );

  const getSnapshot = useCallback(() => bus.getSnapshot(), [bus]);

  const snapshotStr = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const snapshot = JSON.parse(snapshotStr) as { pending: number };

  return {
    dispatch: bus.dispatch,
    isResolving: snapshot.pending > 0,
    pendingCount: snapshot.pending,
  };
}
