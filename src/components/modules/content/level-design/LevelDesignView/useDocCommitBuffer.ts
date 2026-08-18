'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LevelDesignDocument, UpdateDocPayload } from '@/types/level-design';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useIsMounted } from '@/hooks/useIsMounted';
import type { Result } from '@/types/result';

/** Everything a level-design PUT can carry, minus the row id. */
export type DocPatch = Omit<UpdateDocPayload, 'id'>;

export interface CommitOptions {
  /**
   * Escalate a `synced` document to `doc-ahead` when this edit is COMMITTED.
   * The flag is remembered on the buffer, so a 60-event drag flips the badge
   * exactly once — on the write — not once per mouse-move.
   */
  marksDocAhead?: boolean;
}

interface UseDocCommitBufferArgs {
  /** The server's copy of the open document (null when none is open). */
  baseDoc: LevelDesignDocument | null;
  updateDoc: (payload: UpdateDocPayload) => Promise<Result<LevelDesignDocument, string>>;
}

export interface DocCommitBuffer {
  /** `baseDoc` with the uncommitted local edits applied — what the UI renders. */
  doc: LevelDesignDocument | null;
  /** True while local edits have not reached the server. */
  isDirty: boolean;
  isSaving: boolean;
  /** Set when a commit FAILED. The buffer is kept, so `retry()` can re-send it. */
  saveError: string | null;
  /** Local-only edit. Never touches the network — used for drag mouse-move. */
  stage: (patch: DocPatch, opts?: CommitOptions) => void;
  /** Local edit + a commit one typing-pause later. Used for text fields. */
  stageDebounced: (patch: DocPatch, opts?: CommitOptions) => void;
  /** Local edit + an immediate commit. Used for discrete acts (mouseup, clicks). */
  commit: (patch?: DocPatch, opts?: CommitOptions) => void;
  /** Commit whatever is buffered right now (blur, document switch, unmount). */
  flush: () => void;
  /** Re-send the buffered edit after a failure. */
  retry: () => void;
  dismissError: () => void;
}

/**
 * How long a typed edit rests before it is written. Sourced from the shared
 * timing table so it is tuned with the rest of the app's debounces, never as a
 * magic number at the call site.
 */
const TEXT_COMMIT_DEBOUNCE_MS = UI_TIMEOUTS.textEditDebounce;

const EMPTY_PATCH: DocPatch = {};

type PendingEntry = { docId: number; patch: DocPatch } | null;

/** The buffered patch for `docId`, or an empty patch when it belongs to another doc. */
function patchFor(entry: PendingEntry, docId: number): DocPatch {
  return entry && entry.docId === docId ? entry.patch : EMPTY_PATCH;
}

/**
 * Commits, not keystrokes.
 *
 * Every level-design edit used to be a PUT + a full re-GET: a node drag wrote
 * ~60 times a second and a typed sentence wrote once per character, each round
 * trip blanking the editor and re-echoing a controlled value back into the
 * textarea (dropped characters, lost focus).
 *
 * This buffer splits the two halves of an edit:
 *   - the LOCAL half is instant and unconditional (`stage`) — the UI renders
 *     `baseDoc` merged with the buffered patch, so nothing ever lags the cursor;
 *   - the REMOTE half happens on a real commit boundary — mouseup, a click, a
 *     typing pause, blur, switching documents, or unmount.
 *
 * A failed commit KEEPS the buffer (the user's work stays on screen and stays
 * editable) and reports `saveError` for a visible retry, instead of the old
 * silent `console.error` + revert-on-next-refetch.
 */
export function useDocCommitBuffer({ baseDoc, updateDoc }: UseDocCommitBufferArgs): DocCommitBuffer {
  const isMounted = useIsMounted();

  const [pending, setPending] = useState<PendingEntry>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mirror of `pending` readable from timers/callbacks without re-subscribing.
  const pendingRef = useRef<PendingEntry>(null);
  // Bumped by every stage; lets a completed commit tell "nothing changed while
  // I was in flight" (clear the buffer) from "a newer edit landed" (keep it).
  const stageSeqRef = useRef(0);
  const marksDocAheadRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writePending = useCallback((next: PendingEntry) => {
    pendingRef.current = next;
    stageSeqRef.current++;
    if (isMounted()) setPending(next);
  }, [isMounted]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stage = useCallback((patch: DocPatch, opts?: CommitOptions) => {
    if (!baseDoc) return;
    if (opts?.marksDocAhead) marksDocAheadRef.current = true;
    writePending({ docId: baseDoc.id, patch: { ...patchFor(pendingRef.current, baseDoc.id), ...patch } });
  }, [baseDoc, writePending]);

  const commitNow = useCallback(async (extra?: DocPatch, opts?: CommitOptions) => {
    clearTimer();
    if (!baseDoc) return;
    if (opts?.marksDocAhead) marksDocAheadRef.current = true;

    const merged: DocPatch = { ...patchFor(pendingRef.current, baseDoc.id), ...(extra ?? EMPTY_PATCH) };
    if (Object.keys(merged).length === 0) return;

    // One flip per committed change. An explicit syncStatus in the patch (e.g. the
    // codegen callback marking the doc `synced`) always wins over the escalation.
    if (merged.syncStatus === undefined && marksDocAheadRef.current && baseDoc.syncStatus === 'synced') {
      merged.syncStatus = 'doc-ahead';
    }

    writePending({ docId: baseDoc.id, patch: merged });
    const seqAtCommit = stageSeqRef.current;

    if (isMounted()) {
      setIsSaving(true);
      setSaveError(null);
    }

    const result = await updateDoc({ id: baseDoc.id, ...merged });
    if (!isMounted()) return;

    setIsSaving(false);
    if (result.ok) {
      marksDocAheadRef.current = false;
      // Nothing was staged while the write was in flight → the server copy is now
      // authoritative and the overlay can go. Otherwise keep the (cumulative)
      // buffer; its own commit boundary will send it.
      if (stageSeqRef.current === seqAtCommit) writePending(null);
    } else {
      setSaveError(result.error);
    }
  }, [baseDoc, clearTimer, isMounted, updateDoc, writePending]);

  const commit = useCallback((patch?: DocPatch, opts?: CommitOptions) => {
    void commitNow(patch, opts);
  }, [commitNow]);

  // Timers fire long after the render that scheduled them — always call the
  // freshest commit so the write targets the currently open document.
  const commitRef = useRef(commitNow);
  useEffect(() => { commitRef.current = commitNow; });

  const stageDebounced = useCallback((patch: DocPatch, opts?: CommitOptions) => {
    stage(patch, opts);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void commitRef.current();
    }, TEXT_COMMIT_DEBOUNCE_MS);
  }, [stage, clearTimer]);

  const flush = useCallback(() => {
    if (!timerRef.current && !pendingRef.current) return;
    void commitRef.current();
  }, []);

  // Leaving the module must not silently drop a buffered edit. The state writes
  // inside commitNow are already mount-guarded, so this is a write-only flush.
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  useEffect(() => () => { flushRef.current(); }, []);

  const doc = useMemo(() => {
    if (!baseDoc) return null;
    if (!pending || pending.docId !== baseDoc.id) return baseDoc;
    return { ...baseDoc, ...pending.patch };
  }, [baseDoc, pending]);

  const retry = useCallback(() => { void commitNow(); }, [commitNow]);
  const dismissError = useCallback(() => setSaveError(null), []);

  return {
    doc,
    isDirty: pending !== null && pending.docId === baseDoc?.id,
    isSaving,
    saveError,
    stage,
    stageDebounced,
    commit,
    flush,
    retry,
    dismissError,
  };
}
