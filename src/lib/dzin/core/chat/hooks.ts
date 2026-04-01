import { useSyncExternalStore, useCallback } from 'react';
import type { ChatMessage, ChatStore } from './types';

// ---------------------------------------------------------------------------
// useChatMessages
// ---------------------------------------------------------------------------

/**
 * React hook that subscribes to a ChatStore and re-renders on message changes.
 * Uses useSyncExternalStore with a version counter for O(1) snapshot comparison
 * instead of JSON serialization.
 */
export function useChatMessages(store: ChatStore): ChatMessage[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store]
  );

  const getVersion = useCallback(() => store.getVersion(), [store]);

  useSyncExternalStore(subscribe, getVersion, getVersion);
  return store.messages;
}
