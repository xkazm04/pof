'use client';

/**
 * The Game home's build-health read (ticket F-10): `GET /api/games/<id>/build-health`. The panel
 * never touches `fs` (a client import of the server reader once made `/` return 500); every
 * verdict is the server's. No polling: the evidence changes when the game's CI or a local run
 * writes it, so the panel re-reads on demand.
 */
import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { BuildHealth } from '@/lib/games/godot/buildHealthTypes';

export type BuildHealthRead =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: BuildHealth };

export function buildHealthUrl(gameId: string, lane?: string | null): string {
  return `/api/games/${encodeURIComponent(gameId)}/build-health${lane ? `?lane=${encodeURIComponent(lane)}` : ''}`;
}

/** A response is usable only when it carries the fields the panel reads. Exported for tests. */
export function isBuildHealth(v: unknown): v is BuildHealth {
  const d = v as Partial<BuildHealth> | null;
  return !!d && (d.binding === 'bound' || d.binding === 'unbound') && Array.isArray(d.rows)
    && typeof d.readAt === 'string' && typeof d.aggregate === 'object' && d.aggregate !== null;
}

export function useBuildHealth(gameId: string, lane: string | null = null): { read: BuildHealthRead; reread: () => void } {
  const [state, setState] = useState<{ key: string; read: BuildHealthRead }>({ key: '', read: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const key = `${gameId}#${lane ?? ''}#${attempt}`;
  useEffect(() => {
    let cancelled = false;
    void tryApiFetch<unknown>(buildHealthUrl(gameId, lane)).then((r) => {
      if (cancelled) return;
      const read: BuildHealthRead = !r.ok ? { kind: 'error', message: r.error }
        : isBuildHealth(r.data) ? { kind: 'ok', data: r.data }
          : { kind: 'error', message: 'unexpected response shape' };
      setState({ key, read });
    });
    return () => { cancelled = true; };
  }, [gameId, lane, key]);
  const reread = useCallback(() => setAttempt((n) => n + 1), []);
  return { read: state.key === key ? state.read : { kind: 'loading' }, reread };
}
