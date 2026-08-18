'use client';

import { useCallback, useMemo } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useEntityCommitBuffer } from '@/hooks/useEntityCommitBuffer';

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
 * A single field's value, boxed so the buffer's doc/patch types work for a
 * primitive `T` (a bare `null`/`0`/`''` would be indistinguishable from "no
 * record open").
 */
type Boxed<T> = { v: T };

const applyBox = <T,>(_base: Boxed<T>, patch: Boxed<T>): Boxed<T> => patch;
const foldBox = <T,>(_prev: Boxed<T> | null, next: Boxed<T>): Boxed<T> => next;

/**
 * Local-first field editing: every keystroke used to fire a PUT plus a full
 * refetch of every audio scene. This holds the edit in a local draft, commits
 * ONCE per typing pause, and — crucially — only drops the draft when the commit
 * RESOLVES, so the value never flickers back to the round-trip-stale server copy
 * and a failed write leaves the user's text on screen instead of erasing it.
 *
 * The single-field face of the shared `useEntityCommitBuffer` (which owns the
 * stage/debounce/commit engine and its ordering + failure guarantees).
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
  const base = useMemo<Boxed<T>>(() => ({ v: serverValue }), [serverValue]);

  const write = useCallback(async (patch: Boxed<T>) => { await commit(patch.v); }, [commit]);

  const { doc, isDirty, saveError, stageDebounced, retry, dismissError } =
    useEntityCommitBuffer<Boxed<T>, Boxed<T>>({
      base,
      apply: applyBox,
      fold: foldBox,
      commit: write,
      debounceMs: delay,
    });

  const onChange = useCallback((next: T) => { stageDebounced({ v: next }); }, [stageDebounced]);

  return {
    value: doc ? doc.v : serverValue,
    onChange,
    isPending: isDirty,
    error: saveError,
    retry,
    dismissError,
  };
}
