'use client';

/**
 * The Decisions room's reads and its one write. The board is `GET /api/games/<id>/decisions`, re-read every
 * `UI_TIMEOUTS.decisionsPoll` while the room is shown and the tab visible (`useSuspendableEffect`); a failed poll
 * keeps the last good board and says it is stale. The page token comes from `.../decisions/gate` (a browser-only
 * mint, the Voice room's gate) and is refreshed at half-life; an answer is POSTed only from the Save click handler,
 * carrying it in `x-voice-gate`.
 */
import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { DecisionsBoard } from '@/lib/games/decisions/decisionTypes';
import type { Result } from '@/types/result';
import { VOICE_GATE_HEADER, VOICE_GATE_TTL_MS } from '../voice/voiceGateClient';

export const decisionsUrl = (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/decisions`;

export type BoardRead =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: DecisionsBoard; staleError?: string };

export function isBoard(v: unknown): v is DecisionsBoard {
  const d = v as Partial<DecisionsBoard> | null;
  return !!d && typeof d.configured === 'boolean' && Array.isArray(d.open) && Array.isArray(d.answered) && Array.isArray(d.problems);
}

export function useDecisionsBoard(gameId: string): { read: BoardRead; reread: () => void } {
  const [read, setRead] = useState<BoardRead>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useSuspendableEffect(() => {
    let cancelled = false;
    const load = () => {
      void tryApiFetch<unknown>(decisionsUrl(gameId)).then((r) => {
        if (cancelled) return;
        if (r.ok && isBoard(r.data)) { setRead({ kind: 'ok', data: r.data }); return; }
        const message = r.ok ? 'unexpected response shape' : r.error;
        setRead((prev) => (prev.kind === 'ok' ? { kind: 'ok', data: prev.data, staleError: message } : { kind: 'error', message }));
      });
    };
    load();
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, UI_TIMEOUTS.decisionsPoll);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, attempt]);
  return { read, reread: useCallback(() => setAttempt((n) => n + 1), []) };
}

/** The page-held gate token (null until minted, or with the refusal reason). */
export function useDecisionsGate(gameId: string): { token: string | null; error: string | null } {
  const [s, setS] = useState<{ token: string | null; error: string | null }>({ token: null, error: null });
  useSuspendableEffect(() => {
    let cancelled = false;
    const mint = () => {
      void tryApiFetch<{ token: string }>(`${decisionsUrl(gameId)}/gate`).then((r) => {
        if (cancelled) return;
        setS(r.ok ? { token: r.data.token, error: null } : { token: null, error: r.error });
      });
    };
    mint();
    const id = setInterval(mint, VOICE_GATE_TTL_MS / 2);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId]);
  return s;
}

/** How many questions wait for the owner, for the Game home's entry button; undefined until the first read (never 0 by default). */
export function useOpenDecisionCount(gameId: string, enabled: boolean): number | undefined {
  const [n, setN] = useState<number | undefined>(undefined);
  useSuspendableEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      void tryApiFetch<unknown>(decisionsUrl(gameId)).then((r) => {
        if (!cancelled && r.ok && isBoard(r.data)) setN(r.data.open.length);
      });
    };
    load();
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, UI_TIMEOUTS.decisionsPoll);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, enabled]);
  return n;
}

export interface SavedAnswer { answer: { id: string; choice: string; note: string; at: string }; replaced: boolean }

export function postAnswer(gameId: string, body: { id: string; choice: string; note: string }, token: string | null): Promise<Result<SavedAnswer, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers[VOICE_GATE_HEADER] = token;
  return tryApiFetch<SavedAnswer>(decisionsUrl(gameId), { method: 'POST', headers, body: JSON.stringify(body) });
}
