import { useSyncExternalStore, useCallback } from 'react';
import type { ChatMessage, ChatStore } from './types';

// ---------------------------------------------------------------------------
// useChatMessages
// ---------------------------------------------------------------------------

/**
 * React hook that subscribes to a ChatStore and re-renders on message changes.
 * Uses useSyncExternalStore for tear-free reads, following the same pattern
 * as useWorkspaceState from the state module.
 */
export function useChatMessages(store: ChatStore): ChatMessage[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);

  const snapshotStr = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return JSON.parse(snapshotStr) as ChatMessage[];
}
