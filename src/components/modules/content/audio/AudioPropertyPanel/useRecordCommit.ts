'use client';

import { useCallback, useMemo } from 'react';
import { useEntityCommitBuffer } from '@/hooks/useEntityCommitBuffer';

/**
 * The record face of the shared `useEntityCommitBuffer`, for a panel that edits
 * MANY fields of ONE record (a zone, an emitter) rather than the single field
 * `useDebouncedCommit` boxes.
 *
 * Before this, every control in the property panel called
 * `onUpdate({ ...zone, [key]: value })` per keystroke / per slider frame, and the
 * consumer routed that to `updateDoc` — a PUT of the whole scene plus a refetch
 * of EVERY scene, per character, with the failure swallowed into `null`.
 *
 * Here the edit is local and instant; the write happens on a real commit
 * boundary (typing pause, slider release, chip click, leaving the panel) through
 * the THROWING commit path, so a refusal is visible and retryable and the user's
 * value survives it.
 *
 * `record.id` is the buffer's entity id, so a patch staged against one zone can
 * never be written onto another. Callers must still key the panel by that id so
 * `flushOnUnmount` writes a pending edit when the selection changes.
 */
export interface RecordCommit<T> {
  /** The server record with the uncommitted local edits applied — what to render. */
  value: T;
  /** A local edit has not yet been confirmed by the server. */
  isPending: boolean;
  /** Reason the last commit failed (`null` when it succeeded or none ran). */
  error: string | null;
  /** Local now, one write per typing/drag pause. Text boxes, slider drags. */
  edit: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Local now, write now. Discrete acts: a preset chip, a mode button. */
  pick: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Write whatever is buffered right now — slider release, field blur. */
  release: () => void;
  /** Re-send the buffered edit after a failure. */
  retry: () => void;
  /** Hide the error banner; the draft is kept (dismissing is not discarding). */
  dismissError: () => void;
}

/** `{ [key]: value }` as a real `Partial<T>` — no cast, so the key/value pair stays checked. */
function patchOf<T, K extends keyof T>(key: K, value: T[K]): Partial<T> {
  const patch: Partial<T> = {};
  patch[key] = value;
  return patch;
}

const applyPatch = <T,>(base: T, patch: Partial<T>): T => ({ ...base, ...patch });
const foldPatch = <T,>(prev: Partial<T> | null, next: Partial<T>): Partial<T> =>
  (prev ? { ...prev, ...next } : next);

export function useRecordCommit<T extends { id: string }>(
  record: T,
  /** Persists ONE patch. Must reject when the server refused it. */
  commit: (patch: Partial<T>) => void | Promise<unknown>,
): RecordCommit<T> {
  const write = useCallback(async (patch: Partial<T>) => { await commit(patch); }, [commit]);

  const {
    doc, isDirty, saveError, stageDebounced, commit: commitPatch, flush, retry, dismissError,
  } = useEntityCommitBuffer<T, Partial<T>>({
    base: record,
    entityId: record.id,
    apply: applyPatch,
    fold: foldPatch,
    commit: write,
    // Deselecting the zone/emitter unmounts the panel; a debounce still counting
    // down would otherwise drop the user's last word on the floor.
    flushOnUnmount: true,
  });

  const edit = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    stageDebounced(patchOf<T, K>(key, value));
  }, [stageDebounced]);

  const pick = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    commitPatch(patchOf<T, K>(key, value));
  }, [commitPatch]);

  return useMemo(() => ({
    value: doc ?? record,
    isPending: isDirty,
    error: saveError,
    edit,
    pick,
    release: flush,
    retry,
    dismissError,
  }), [doc, record, isDirty, saveError, edit, pick, flush, retry, dismissError]);
}
