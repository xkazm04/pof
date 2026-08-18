'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';

export interface DebouncedCommit<T> {
  /** What the control renders: the local draft while one exists, else the server value. */
  value: T;
  /** Record an edit locally now; persist it once the user stops for `delay` ms. */
  onChange: (next: T) => void;
  /** A local edit has not yet been confirmed by the server. */
  isPending: boolean;
  /** Reason the last commit failed (`null` when it succeeded or none ran). */
  error: string | null;
  /** Re-send the buffered draft. */
  retry: () => void;
  /** Hide the error banner — the draft is kept, dismissing is not discarding. */
  dismissError: () => void;
}

/**
 * Local-first field editing: every keystroke used to fire a PUT plus a full
 * refetch of every audio scene. This holds the edit in a local draft, commits
 * ONCE per typing pause, and — crucially — only drops the draft when the commit
 * RESOLVES, so the value never flickers back to the round-trip-stale server copy
 * and a failed write leaves the user's text on screen instead of erasing it.
 *
 * `commit` must reject on failure (see `useAudioScene.commitDoc`); a promise that
 * resolves is taken as "the server has it now".
 *
 * The draft has no identity of its own, so callers editing a *switchable* record
 * must key the component by that record's id (see `AudioView` keying the
 * Soundscapes/Settings tabs by `activeDoc.id`).
 */
export function useDebouncedCommit<T>(
  serverValue: T,
  commit: (next: T) => void | Promise<unknown>,
  delay: number = UI_TIMEOUTS.textEditDebounce,
): DebouncedCommit<T> {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (next: T) => {
    const mine = ++seq.current;
    setError(null);
    try {
      await commit(next);
      // A newer edit landed while this was in flight — it owns the draft now.
      if (seq.current === mine) setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
    }
  }, [commit]);

  const onChange = useCallback((next: T) => {
    setDraft({ v: next });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void run(next);
    }, delay);
  }, [run, delay]);

  const retry = useCallback(() => {
    if (draft) void run(draft.v);
  }, [draft, run]);

  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    value: draft ? draft.v : serverValue,
    onChange,
    isPending: draft !== null,
    error,
    retry,
    dismissError,
  };
}
