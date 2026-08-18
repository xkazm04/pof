'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useIsMounted } from '@/hooks/useIsMounted';

/**
 * How an edit made in an editor should reach the server.
 *
 * The three values map one-to-one onto `useEntityCommitBuffer`'s methods:
 *   - `stage`    → local only, zero writes (a drag's mouse-move frames)
 *   - `debounce` → local now, one write after the typing/repeat pause (text, key nudge)
 *   - `commit`   → local now, write now (discrete acts: mouseup, a click, add/delete)
 *
 * Callers that omit the mode get `commit`, so an editor rendered without a
 * buffer (previews, tests) behaves exactly as it did before the buffer existed.
 */
export type EditCommitMode = 'commit' | 'stage' | 'debounce';

/**
 * Identity of the record a buffered edit belongs to. `null` means "the caller
 * keys the component by the record instead" (see `useDebouncedCommit`).
 */
export type EntityKey = string | number | null;

type Entry<TPatch> = { id: EntityKey; patch: TPatch } | null;

export interface EntityCommitBufferOptions<TDoc, TPatch> {
  /** The server's copy of the record (`null` when none is open). */
  base: TDoc | null;
  /**
   * Identity of `base`. A buffer staged against a different id is ignored for
   * rendering and never written, so switching records cannot leak an edit.
   */
  entityId?: EntityKey;
  /**
   * Overlay a buffered patch onto the server copy — what the UI renders.
   * MUST be referentially stable (module scope or `useCallback`).
   */
  apply: (base: TDoc, patch: TPatch) => TDoc;
  /**
   * Fold a newer patch into the one already buffered (`null` when none is).
   * MUST be referentially stable.
   */
  fold: (prev: TPatch | null, next: TPatch) => TPatch;
  /** True when the folded patch carries nothing worth writing (skips the write). */
  isEmpty?: (patch: TPatch) => boolean;
  /**
   * Last chance to amend the patch about to be written — for a flag that should
   * flip once per COMMIT rather than once per staged event. The returned patch
   * is what gets buffered, so a failed write retries the amended version.
   */
  finalize?: (patch: TPatch, base: TDoc) => TPatch;
  /** The write. MUST reject when the server refused it — a resolve means "saved". */
  commit: (patch: TPatch, base: TDoc) => void | Promise<unknown>;
  /** Ran after a write the server accepted (reset whatever `finalize` reads). */
  onCommitted?: () => void;
  /** Typing-pause length for `stageDebounced`. */
  debounceMs?: number;
  /** Commit whatever is buffered when the component goes away. Default `false`. */
  flushOnUnmount?: boolean;
  /** Shown when a rejection carries no `Error` of its own. */
  errorMessage?: string;
}

export interface EntityCommitBuffer<TDoc, TPatch> {
  /** `base` with the uncommitted local edits applied — what the UI renders. */
  doc: TDoc | null;
  /** True while local edits for the current entity have not reached the server. */
  isDirty: boolean;
  isSaving: boolean;
  /** Set when a commit FAILED. The buffer is kept, so `retry()` can re-send it. */
  saveError: string | null;
  /** Local-only edit. Never touches the network — used for drag mouse-move. */
  stage: (patch: TPatch) => void;
  /** Local edit + a commit one typing-pause later. Used for text fields. */
  stageDebounced: (patch: TPatch) => void;
  /** Local edit + an immediate commit. Used for discrete acts (mouseup, clicks). */
  commit: (patch?: TPatch) => void;
  /** Commit whatever is buffered right now (blur, record switch, unmount). */
  flush: () => void;
  /** Re-send the buffered edit after a failure. */
  retry: () => void;
  dismissError: () => void;
  /**
   * The merged doc read straight from refs — safe inside an event handler that
   * must see the frame staged by the previous event of the same gesture.
   */
  peek: () => TDoc | null;
}

/**
 * Commits, not keystrokes — the one optimistic edit buffer.
 *
 * Two wave-9 lots built this engine independently (the audio scene painter's
 * `SceneDraft`/`runCommit`, level-design's `useDocCommitBuffer`) and converged on
 * the same guarantees. This is that engine, extracted; the domain types are the
 * only thing a consumer supplies.
 *
 * It splits the two halves of an edit:
 *   - the LOCAL half is instant and unconditional (`stage`) — the UI renders
 *     `base` merged with the buffered patch, so nothing ever lags the cursor;
 *   - the REMOTE half happens on a real commit boundary — mouseup, a click, a
 *     typing pause, blur, switching records, or (opt-in) unmount.
 *
 * Guarantees, the union of both originals:
 *   - the buffer is cleared only when a commit RESOLVES, so the props arriving a
 *     round trip later can never snap the canvas/field back;
 *   - a stage counter stops a slow earlier commit from clearing a newer
 *     gesture's buffer;
 *   - a commit counter stops an earlier commit from clearing the saving flag out
 *     from under a newer one;
 *   - a FAILED commit keeps the buffer (the user's work stays on screen and stays
 *     editable) and reports `saveError` for a visible retry — never a silent
 *     `console.error` plus revert-on-next-refetch.
 */
export function useEntityCommitBuffer<TDoc, TPatch>({
  base,
  entityId = null,
  apply,
  fold,
  isEmpty,
  finalize,
  commit: write,
  onCommitted,
  debounceMs = UI_TIMEOUTS.textEditDebounce,
  flushOnUnmount = false,
  errorMessage = 'Could not save the change.',
}: EntityCommitBufferOptions<TDoc, TPatch>): EntityCommitBuffer<TDoc, TPatch> {
  const isMounted = useIsMounted();

  const [entry, setEntry] = useState<Entry<TPatch>>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mirror of `entry` readable from timers/handlers without re-subscribing.
  const entryRef = useRef<Entry<TPatch>>(null);
  // Bumped by every stage; lets a completed commit tell "nothing changed while I
  // was in flight" (clear the buffer) from "a newer edit landed" (keep it).
  const stageSeqRef = useRef(0);
  // Bumped by every commit; only the newest in-flight write owns `isSaving`.
  const commitSeqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read by `peek` alone, so an event handler mid-gesture sees the live values
  // rather than the ones captured when its callback was created.
  const baseRef = useRef(base);
  const entityIdRef = useRef(entityId);
  const applyRef = useRef(apply);
  useEffect(() => {
    baseRef.current = base;
    entityIdRef.current = entityId;
    applyRef.current = apply;
  });

  /** The buffered patch for `id`, or `null` when it belongs to another record. */
  const patchFor = useCallback((id: EntityKey): TPatch | null => {
    const e = entryRef.current;
    return e && e.id === id ? e.patch : null;
  }, []);

  const writeEntry = useCallback((next: Entry<TPatch>) => {
    entryRef.current = next;
    stageSeqRef.current++;
    if (isMounted()) setEntry(next);
  }, [isMounted]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stage = useCallback((patch: TPatch) => {
    if (base === null) return;
    writeEntry({ id: entityId, patch: fold(patchFor(entityId), patch) });
  }, [base, entityId, fold, patchFor, writeEntry]);

  const commitNow = useCallback(async (extra?: TPatch) => {
    clearTimer();
    if (base === null) return;

    const buffered = patchFor(entityId);
    const merged = extra === undefined ? buffered : fold(buffered, extra);
    if (merged === null) return;
    if (isEmpty?.(merged)) return;

    const finalPatch = finalize ? finalize(merged, base) : merged;
    writeEntry({ id: entityId, patch: finalPatch });
    const stageAtCommit = stageSeqRef.current;
    const mine = ++commitSeqRef.current;

    if (isMounted()) {
      setIsSaving(true);
      setSaveError(null);
    }

    try {
      await write(finalPatch, base);
      if (!isMounted()) return;
      onCommitted?.();
      // Nothing was staged while the write was in flight → the server copy is now
      // authoritative and the overlay can go. Otherwise keep the (cumulative)
      // buffer; its own commit boundary will send it.
      if (stageSeqRef.current === stageAtCommit) writeEntry(null);
    } catch (err) {
      if (!isMounted()) return;
      setSaveError(err instanceof Error ? err.message : errorMessage);
    } finally {
      if (isMounted() && commitSeqRef.current === mine) setIsSaving(false);
    }
  }, [
    base, entityId, clearTimer, patchFor, fold, isEmpty, finalize,
    writeEntry, isMounted, write, onCommitted, errorMessage,
  ]);

  const commit = useCallback((patch?: TPatch) => { void commitNow(patch); }, [commitNow]);
  const retry = useCallback(() => { void commitNow(); }, [commitNow]);
  const dismissError = useCallback(() => setSaveError(null), []);

  // Timers fire long after the render that scheduled them — always call the
  // freshest commit so the write targets the currently open record.
  const commitRef = useRef(commitNow);
  useEffect(() => { commitRef.current = commitNow; });

  const stageDebounced = useCallback((patch: TPatch) => {
    stage(patch);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void commitRef.current();
    }, debounceMs);
  }, [stage, clearTimer, debounceMs]);

  const flush = useCallback(() => {
    if (!timerRef.current && !entryRef.current) return;
    void commitRef.current();
  }, []);

  // Leaving the editor must not silently drop a buffered edit — for consumers
  // that opted in. The state writes inside `commitNow` are mount-guarded, so the
  // unmount path is write-only.
  const flushOnUnmountRef = useRef(flushOnUnmount);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushOnUnmountRef.current = flushOnUnmount;
    flushRef.current = flush;
  });
  useEffect(() => () => {
    if (flushOnUnmountRef.current) flushRef.current();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const doc = useMemo(() => {
    if (base === null) return null;
    if (!entry || entry.id !== entityId) return base;
    return apply(base, entry.patch);
  }, [base, entry, entityId, apply]);

  const peek = useCallback((): TDoc | null => {
    const b = baseRef.current;
    if (b === null) return null;
    const p = patchFor(entityIdRef.current);
    return p === null ? b : applyRef.current(b, p);
  }, [patchFor]);

  const isDirty = entry !== null && entry.id === entityId;

  return useMemo(() => ({
    doc,
    isDirty,
    isSaving,
    saveError,
    stage,
    stageDebounced,
    commit,
    flush,
    retry,
    dismissError,
    peek,
  }), [doc, isDirty, isSaving, saveError, stage, stageDebounced, commit, flush, retry, dismissError, peek]);
}
