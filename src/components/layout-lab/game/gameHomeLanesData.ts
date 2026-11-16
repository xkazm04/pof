'use client';

/**
 * The lanes control room's read: `GET /api/games/<id>/lanes`, re-read every `UI_TIMEOUTS.lanesPoll` while the
 * view is visible (`useSuspendableEffect`: a hidden module stops polling). The panel never touches `fs` or git;
 * every field is the server's. A failed poll keeps the last good board and says it is stale rather than blanking it.
 */
import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type { LanesBoard } from '@/lib/games/runners/runnerTypes';

export type LanesRead =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: LanesBoard; staleError?: string };

export const lanesUrl = (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/lanes`;

/** A response is usable only when it carries the fields the panel reads. Exported for tests. */
export function isLanesBoard(v: unknown): v is LanesBoard {
  const d = v as Partial<LanesBoard> | null;
  return !!d && typeof d.configured === 'boolean' && Array.isArray(d.roots) && typeof d.readAt === 'string';
}

export function useLanesBoard(gameId: string): { read: LanesRead; reread: () => void } {
  const key = gameId;
  const [state, setState] = useState<{ key: string; read: LanesRead }>({ key, read: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);

  useSuspendableEffect(() => {
    let cancelled = false;
    const load = () => {
      void tryApiFetch<unknown>(lanesUrl(gameId)).then((r) => {
        if (cancelled) return;
        if (r.ok && isLanesBoard(r.data)) { const data = r.data; setState({ key, read: { kind: 'ok', data } }); return; }
        const message = r.ok ? 'unexpected response shape' : r.error;
        setState((prev) => ({ key, read: prev.key === key && prev.read.kind === 'ok' ? { kind: 'ok', data: prev.read.data, staleError: message } : { kind: 'error', message } }));
      });
    };
    load();
    const timer = setInterval(load, UI_TIMEOUTS.lanesPoll);
    return () => { cancelled = true; clearInterval(timer); };
  }, [key, gameId, attempt]);

  const reread = useCallback(() => setAttempt((n) => n + 1), []);
  return { read: state.key === key ? state.read : { kind: 'loading' }, reread };
}
