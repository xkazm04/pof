'use client';

/**
 * The Combat lab's read: `GET /api/games/<id>/combat-lab?source=`, re-read every `UI_TIMEOUTS.combatLabPoll` while
 * the room is shown (`useSuspendableEffect`). A failed poll keeps the last good read and says it is stale. The panel
 * never touches `fs`; every field, age included, is the server's.
 */
import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type { CombatLabRead } from '@/lib/games/combatLab/combatTypes';

export type CombatRead =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: CombatLabRead; staleError?: string };

export const combatLabUrl = (gameId: string, source: string) =>
  `/api/games/${encodeURIComponent(gameId)}/combat-lab?source=${encodeURIComponent(source)}`;

export function isCombatRead(v: unknown): v is CombatLabRead {
  const d = v as Partial<CombatLabRead> | null;
  return !!d && typeof d.configured === 'boolean' && Array.isArray(d.tables) && Array.isArray(d.sources) && !!d.telemetry && Array.isArray(d.telemetry.sessions);
}

export function useCombatLab(gameId: string, source: string): { read: CombatRead; reread: () => void } {
  const [read, setRead] = useState<CombatRead>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useSuspendableEffect(() => {
    let cancelled = false;
    const load = () => {
      void tryApiFetch<unknown>(combatLabUrl(gameId, source)).then((r) => {
        if (cancelled) return;
        if (r.ok && isCombatRead(r.data)) { setRead({ kind: 'ok', data: r.data }); return; }
        const message = r.ok ? 'unexpected response shape' : r.error;
        setRead((prev) => (prev.kind === 'ok' ? { kind: 'ok', data: prev.data, staleError: message } : { kind: 'error', message }));
      });
    };
    load();
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, UI_TIMEOUTS.combatLabPoll);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, source, attempt]);
  return { read, reread: useCallback(() => setAttempt((n) => n + 1), []) };
}
