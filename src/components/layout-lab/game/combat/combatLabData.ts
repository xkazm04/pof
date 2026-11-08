'use client';

/**
 * The Combat lab's read: `GET /api/games/<id>/combat-lab?source=`, re-read every `UI_TIMEOUTS.combatLabPoll` while
 * the room is shown (`useSuspendableEffect`). A failed poll keeps the last good read OF THE SAME SOURCE and says it is stale; a read never outlives its source (a switch reads loading). The panel
 * never touches `fs`; every field, age included, is the server's.
 */
import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type { CombatLabRead, CombatSource } from '@/lib/games/combatLab/combatTypes';

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

/** `sources` is the last picker list any read carried, so the picker survives a source switch that is loading or failing. */
export function useCombatLab(gameId: string, source: string): { read: CombatRead; reread: () => void; sources: CombatSource[] | null } {
  const key = `${gameId}#${source}`;
  const [state, setState] = useState<{ key: string; read: CombatRead; sources: CombatSource[] | null }>({ key, read: { kind: 'loading' }, sources: null });
  const [attempt, setAttempt] = useState(0);
  useSuspendableEffect(() => {
    let cancelled = false;
    const load = () => {
      void tryApiFetch<unknown>(combatLabUrl(gameId, source)).then((r) => {
        if (cancelled) return;
        if (r.ok && isCombatRead(r.data)) { const data = r.data; setState((prev) => ({ key, read: { kind: 'ok', data }, sources: data.sources.length ? data.sources : prev.sources })); return; }
        const message = r.ok ? 'unexpected response shape' : r.error;
        setState((prev) => ({
          key, sources: prev.sources,
          read: prev.key === key && prev.read.kind === 'ok' ? { kind: 'ok', data: prev.read.data, staleError: message } : { kind: 'error', message },
        }));
      });
    };
    load();
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, UI_TIMEOUTS.combatLabPoll);
    return () => { cancelled = true; clearInterval(id); };
  }, [key, gameId, source, attempt]);
  return { read: state.key === key ? state.read : { kind: 'loading' }, reread: useCallback(() => setAttempt((n) => n + 1), []), sources: state.sources };
}
