'use client';

/**
 * The owner's round in progress, held in the page until ONE submit sends it all (`casting/submit`): a verdict
 * toggle per voice (click again to clear; Cast is exclusive, so casting one clears Cast on the others), a note
 * per voice, the round comment, and which voices were heard through. Kept in sessionStorage per round, so a
 * reload or a tab switch does not lose a half-judged round (a per-viewer convenience; never the record).
 */
import { useCallback, useEffect, useState } from 'react';
import type { CastVerdict, RoundView } from '@/lib/voice/castingDb';
import { postVoice } from './voiceRoomData';

export type Pick = Exclude<CastVerdict, 'pending'>;
interface Draft { picks: Record<string, Pick | null>; notes: Record<string, string>; comment: string; heard: string[] }

const empty = (): Draft => ({ picks: {}, notes: {}, comment: '', heard: [] });
const key = (roundId: string) => `pof:casting-draft:${roundId}`;

/** Verdicts and notes the server already holds for this round (e.g. given before the one-submit page). */
function saved(r: RoundView): Draft {
  const d = empty();
  for (const { voice, candidate } of r.candidates) {
    if (candidate.verdict !== 'pending') d.picks[voice.id] = candidate.verdict;
    if (candidate.note) d.notes[voice.id] = candidate.note;
  }
  return d;
}

function load(r: RoundView): Draft {
  const base = saved(r);
  try {
    const raw = sessionStorage.getItem(key(r.round.id));
    if (!raw) return base;
    const s = JSON.parse(raw) as Draft;
    return { picks: { ...base.picks, ...s.picks }, notes: { ...base.notes, ...s.notes }, comment: s.comment ?? '', heard: s.heard ?? [] };
  } catch {
    return base;
  }
}

export function useRoundDraft(r: RoundView, gate: string | null, onSubmitted: () => void) {
  const roundId = r.round.id;
  const [d, setD] = useState<Draft>(() => (typeof window === 'undefined' ? saved(r) : load(r)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try { sessionStorage.setItem(key(roundId), JSON.stringify(d)); } catch { /* storage unavailable: the draft lives in memory only */ }
  }, [roundId, d]);

  const pick = useCallback((voiceId: string, p: Pick) => setD((s) => {
    const next = { ...s.picks, [voiceId]: s.picks[voiceId] === p ? null : p };
    if (next[voiceId] === 'cast') for (const id of Object.keys(next)) if (id !== voiceId && next[id] === 'cast') next[id] = null;
    return { ...s, picks: next };
  }), []);
  const note = useCallback((voiceId: string, v: string) => setD((s) => ({ ...s, notes: { ...s.notes, [voiceId]: v } })), []);
  const comment = useCallback((v: string) => setD((s) => ({ ...s, comment: v })), []);
  const heard = useCallback((voiceId: string) => setD((s) => (s.heard.includes(voiceId) ? s : { ...s, heard: [...s.heard, voiceId] })), []);

  const ids = r.candidates.map((c) => c.voice.id);
  const judged = ids.filter((id) => d.picks[id]).length;
  const castId = ids.find((id) => d.picks[id] === 'cast') ?? null;
  const ready = judged === ids.length && !!gate && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const verdicts = ids.map((id) => ({ voiceId: id, verdict: d.picks[id], note: d.notes[id] ?? '' }));
    const res = await postVoice<{ warning: string | null }>('/casting/submit', { roundId, verdicts, note: d.comment }, gate);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    if (res.data.warning) setError(res.data.warning);
    try { sessionStorage.removeItem(key(roundId)); } catch { /* nothing to clear */ }
    onSubmitted();
  };

  return { draft: d, pick, note, comment, heard, judged, total: ids.length, castId, ready, busy, error, submit };
}

export type RoundDraft = ReturnType<typeof useRoundDraft>;
