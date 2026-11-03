'use client';

/**
 * The Voice room's reads and writes. Every read goes through `tryApiFetch` (the `{ success, data }`
 * envelope); a failed read is a visible reason, never an empty room. The human-gate token is fetched
 * from `.../voice/gate` (a browser-only mint) and refreshed at half-life while the room is visible
 * (`useSuspendableEffect`); verdict and cast writes carry it in `x-voice-gate`. The queue and the open line
 * re-read every `UI_TIMEOUTS.voiceRoomPoll` while visible, so CLI-generated takes appear on their own.
 */
import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { RoomState, LineDetail } from '@/lib/voice/room';
import type { Result } from '@/types/result';
import { VOICE_API, VOICE_GATE_HEADER, VOICE_GATE_TTL_MS } from './voiceGateClient';

export type Read<T> = { kind: 'loading' } | { kind: 'error'; reason: string } | { kind: 'ready'; data: T };

function useKeyedRead<T>(url: string | null, pollMs = 0): { read: Read<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  // Re-read on an interval while the room is shown and the tab visible (the previous data stays on screen).
  useSuspendableEffect(() => {
    if (!url || pollMs <= 0) return;
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') setAttempt((n) => n + 1); }, pollMs);
    return () => clearInterval(id);
  }, [url, pollMs]);
  const key = url ? `${url}#${attempt}` : '';
  const [state, setState] = useState<{ key: string; read: Read<T> }>({ key: '', read: { kind: 'loading' } });
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void tryApiFetch<T>(url).then((r) => {
      if (cancelled) return;
      setState({ key, read: r.ok ? { kind: 'ready', data: r.data } : { kind: 'error', reason: r.error } });
    });
    return () => { cancelled = true; };
  }, [url, key]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // Keep showing the previous data while a reload is in flight (no flash to "loading").
  const read = state.key === key ? state.read : state.key.startsWith(`${url}#`) ? state.read : { kind: 'loading' as const };
  return { read, reload };
}

export function useVoiceRoom() {
  return useKeyedRead<RoomState>(VOICE_API, UI_TIMEOUTS.voiceRoomPoll);
}

export interface LineKey { questId: string; lineId: string }

export function useLineDetail(sel: LineKey | null) {
  const url = sel ? `${VOICE_API}/lines?questId=${encodeURIComponent(sel.questId)}&lineId=${encodeURIComponent(sel.lineId)}` : null;
  return useKeyedRead<LineDetail>(url, UI_TIMEOUTS.voiceRoomPoll);
}

/** The page-held gate token (null until minted, or with the refusal reason). */
export function useGateToken(): { token: string | null; error: string | null } {
  const [s, setS] = useState<{ token: string | null; error: string | null }>({ token: null, error: null });
  useSuspendableEffect(() => {
    let cancelled = false;
    const mint = () => {
      void tryApiFetch<{ token: string; expiresAt: number }>(`${VOICE_API}/gate`).then((r) => {
        if (cancelled) return;
        setS(r.ok ? { token: r.data.token, error: null } : { token: null, error: r.error });
      });
    };
    mint();
    const id = setInterval(mint, VOICE_GATE_TTL_MS / 2);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return s;
}

/** POST JSON through the envelope; `gate` adds the human-gate header (verdict and cast only). */
export function postVoice<T>(path: string, body: unknown, gate?: string | null): Promise<Result<T, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (gate) headers[VOICE_GATE_HEADER] = gate;
  return tryApiFetch<T>(`${VOICE_API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

/** `asGame`: the take mastered the way export renders it (game voice level + the speaker's device treatment). */
export const takeAudioUrl = (takeId: string, asGame = false) => `${VOICE_API}/audio?takeId=${encodeURIComponent(takeId)}${asGame ? '&as=game' : ''}`;
export const previewAudioUrl = (voiceId: string, asGame = false) => `${VOICE_API}/audio?voiceId=${encodeURIComponent(voiceId)}${asGame ? '&as=game' : ''}`;

export const fmtMs = (ms: number | null) => (ms === null ? 'unmeasured' : `${(ms / 1000).toFixed(1)} s`);
export const fmtLufs = (l: number | null) => (l === null ? 'loudness unmeasured' : `${l.toFixed(1)} LUFS`);
export const fmtWer = (wer: number) => `${Math.round(wer * 100)} %`;
