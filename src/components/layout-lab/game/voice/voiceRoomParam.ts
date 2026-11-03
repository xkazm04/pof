'use client';

/**
 * `?room=voice` — which room of the game home is open. Read from `window.location` through
 * `useSyncExternalStore` (no `useSearchParams`, so no Suspense boundary is needed and the lab's own
 * address sync, which rewrites only `c/e/s/v`, keeps the param). Moves PUSH a history entry.
 */
import { useSyncExternalStore } from 'react';

const EVENT = 'pof:room-change';

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVENT, cb);
  };
}

const snapshot = () => new URLSearchParams(window.location.search).get('room');

export function useRoomParam(): string | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** The current address with `room` set (or removed when null). */
export function roomHref(room: string | null): string {
  const url = new URL(window.location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openRoom(room: string | null): void {
  window.history.pushState({}, '', roomHref(room));
  window.dispatchEvent(new Event(EVENT));
}
