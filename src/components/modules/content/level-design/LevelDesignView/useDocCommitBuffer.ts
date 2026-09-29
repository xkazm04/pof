'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LevelDesignDocument, UpdateDocPayload } from '@/types/level-design';
import { useEntityCommitBuffer, type EditCommitMode } from '@/hooks/useEntityCommitBuffer';
import { ok, err, type Result } from '@/types/result';
import {
  applyLevelEdit, gestureKey, describeLevelEdit, extendGesture, recordEdit,
  undoStep, redoStep, rebaseHistoryPatch, emptyEditHistory, EDIT_HISTORY_LIMIT,
  type LevelDocPatch, type LevelEditOp, type LevelEdit, type EditHistory, type OpenGesture,
} from '@/lib/level-design/level-edit';

/** Everything a level-design PUT can carry, minus the row id. */
export type DocPatch = LevelDocPatch;

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
  /** The live doc (server copy + buffer) read from refs — current inside a gesture. */
  peek: () => LevelDesignDocument | null;
  /**
   * Apply a named op to the LIVE doc and route it by `mode` (stage / debounce /
   * commit). Consecutive ops of one gesture (same `gestureKey`) become ONE undo
   * entry, closed by the gesture's commit. A refused op changes nothing.
   */
  edit: (op: LevelEditOp, mode?: EditCommitMode) => Result<LevelEdit, string>;
  /** Undo the newest gesture as ONE commit. `ok(null)` = nothing to undo. */
  undo: () => Result<string | null, string>;
  redo: () => Result<string | null, string>;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  undoLabel: string | null;
  redoLabel: string | null;
}

const applyPatch = (doc: LevelDesignDocument, patch: DocPatch): LevelDesignDocument => ({ ...doc, ...patch });
const foldPatch = (prev: DocPatch | null, next: DocPatch): DocPatch => ({ ...(prev ?? {}), ...next });
const isEmptyPatch = (patch: DocPatch): boolean => Object.keys(patch).length === 0;

interface GestureSlot { docId: number; gesture: OpenGesture; mode: EditCommitMode }

/**
 * The level-design face of the shared `useEntityCommitBuffer`, plus the
 * editor's undo history.
 *
 * Every level-design edit used to be a PUT + a full re-GET: a node drag wrote
 * ~60 times a second and a typed sentence wrote once per character, each round
 * trip blanking the editor and re-echoing a controlled value back into the
 * textarea (dropped characters, lost focus). The shared buffer supplies the
 * stage/debounce/commit engine; this adapter supplies the level-design
 * specifics — the `Result`-returning PUT (which must become a rejection so a
 * failure is distinguishable from a save), the one-flip-per-commit `doc-ahead`
 * escalation, and the op history (see `@/lib/level-design/level-edit`).
 */
export function useDocCommitBuffer({ baseDoc, updateDoc }: UseDocCommitBufferArgs): DocCommitBuffer {
  const marksDocAheadRef = useRef(false);
  const docId = baseDoc?.id ?? null;

  // History is per document: entries tagged with another doc read as empty.
  const [history, setHistoryState] = useState<EditHistory>(() => emptyEditHistory(docId));
  const historyRef = useRef(history);
  const setHistory = useCallback((h: EditHistory) => {
    historyRef.current = h;
    setHistoryState(h);
  }, []);
  const historyFor = useCallback((id: number): EditHistory => (
    historyRef.current.docId === id ? historyRef.current : emptyEditHistory(id)
  ), []);

  // The gesture still receiving frames (a drag, a typing burst, held nudges).
  const gestureRef = useRef<GestureSlot | null>(null);
  // Mirrors `gestureRef` for rendering: an open gesture is already undoable.
  const [openGestureDoc, setOpenGestureDoc] = useState<number | null>(null);
  const closeGesture = useCallback(() => {
    const slot = gestureRef.current;
    if (!slot) return;
    gestureRef.current = null;
    setOpenGestureDoc(null);
    const { gesture } = slot;
    const entry = { label: gesture.label, undo: gesture.undo, redo: gesture.redo };
    setHistory(recordEdit(historyFor(slot.docId), entry));
  }, [historyFor, setHistory]);

  // One flip per committed change. An explicit syncStatus in the patch (e.g. the
  // codegen callback marking the doc `synced`) always wins over the escalation.
  // A commit is also where a debounced gesture ends (its pause elapsed, a blur,
  // a doc switch); a staged drag stays open until its own mouseup commit.
  const finalize = useCallback((patch: DocPatch, doc: LevelDesignDocument): DocPatch => {
    if (gestureRef.current && gestureRef.current.mode !== 'stage') closeGesture();
    if (patch.syncStatus === undefined && marksDocAheadRef.current && doc.syncStatus === 'synced') {
      return { ...patch, syncStatus: 'doc-ahead' };
    }
    return patch;
  }, [closeGesture]);

  // The base the tree last rendered, and the server copy of the latest accepted
  // write together with the base it superseded. Between a write resolving and
  // the next render the shared buffer has already dropped its overlay while its
  // base is still the pre-write copy; `peek` below bridges exactly that window, so
  // an op or an undo fired inside it never builds on (or compares against) a
  // document that is missing the write that just landed.
  const renderedBaseRef = useRef(baseDoc);
  useEffect(() => { renderedBaseRef.current = baseDoc; });
  const ackedRef = useRef<{ doc: LevelDesignDocument; over: LevelDesignDocument | null } | null>(null);

  const write = useCallback(async (patch: DocPatch, doc: LevelDesignDocument) => {
    const result = await updateDoc({ id: doc.id, ...patch });
    // The buffer treats a resolve as "the server has it"; a failed PUT must reject.
    if (!result.ok) throw new Error(result.error);
    ackedRef.current = { doc: result.data, over: renderedBaseRef.current };
  }, [updateDoc]);

  const onCommitted = useCallback(() => { marksDocAheadRef.current = false; }, []);

  const {
    doc, isDirty, isSaving, saveError,
    stage: stageBuffer,
    stageDebounced: stageDebouncedBuffer,
    commit: commitBuffer,
    flush, retry, dismissError, peek: peekBuffer,
  } = useEntityCommitBuffer<LevelDesignDocument, DocPatch>({
    base: baseDoc,
    entityId: docId,
    apply: applyPatch,
    fold: foldPatch,
    isEmpty: isEmptyPatch,
    finalize,
    commit: write,
    onCommitted,
    flushOnUnmount: true,
    errorMessage: 'Could not save the document.',
  });

  const peek = useCallback((): LevelDesignDocument | null => {
    const live = peekBuffer();
    const acked = ackedRef.current;
    // No overlay (the buffer handed back its base itself) and no render since the
    // ack: the acknowledged server copy is the live document.
    if (acked && live !== null && live === acked.over && renderedBaseRef.current === acked.over
      && acked.doc.id === live.id) {
      return acked.doc;
    }
    return live;
  }, [peekBuffer]);

  const remember = useCallback((opts?: CommitOptions) => {
    if (opts?.marksDocAhead) marksDocAheadRef.current = true;
  }, []);

  const stage = useCallback((patch: DocPatch, opts?: CommitOptions) => {
    remember(opts);
    stageBuffer(patch);
  }, [remember, stageBuffer]);

  const stageDebounced = useCallback((patch: DocPatch, opts?: CommitOptions) => {
    remember(opts);
    stageDebouncedBuffer(patch);
  }, [remember, stageDebouncedBuffer]);

  const commit = useCallback((patch?: DocPatch, opts?: CommitOptions) => {
    remember(opts);
    commitBuffer(patch);
  }, [remember, commitBuffer]);

  const edit = useCallback((op: LevelEditOp, mode: EditCommitMode = 'commit'): Result<LevelEdit, string> => {
    const live = peek();
    if (!live) return err('No level design is open.');
    const res = applyLevelEdit(live, op);
    if (!res.ok) return res;

    const slot = gestureRef.current;
    const open = slot && slot.docId === live.id ? slot.gesture : null;
    const { closed, pending } = extendGesture(open, gestureKey(op, live), describeLevelEdit(op, live), res.data);
    if (closed) setHistory(recordEdit(historyFor(live.id), closed));
    gestureRef.current = { docId: live.id, gesture: pending, mode };
    setOpenGestureDoc(live.id);

    const opts = { marksDocAhead: res.data.marksDocAhead };
    if (mode === 'stage') stage(res.data.patch, opts);
    else if (mode === 'debounce') stageDebounced(res.data.patch, opts);
    else {
      commit(res.data.patch, opts);
      closeGesture();
    }
    return res;
  }, [peek, historyFor, setHistory, stage, stageDebounced, commit, closeGesture]);

  /** Shared by undo and redo: step the stack, rebase onto the live doc, ONE commit. */
  const travel = useCallback((direction: 'undo' | 'redo'): Result<string | null, string> => {
    closeGesture();
    const live = peek();
    if (!live) return ok(null);
    const h = historyFor(live.id);
    const step = direction === 'undo' ? undoStep(h) : redoStep(h);
    if (!step) return ok(null);
    const [patch, expected] = direction === 'undo'
      ? [step.entry.undo, step.entry.redo]
      : [step.entry.redo, step.entry.undo];
    const rebased = rebaseHistoryPatch(live, patch, expected);
    if (!rebased.ok) {
      setHistory(emptyEditHistory(live.id));
      return rebased;
    }
    setHistory(step.history);
    // Undo is an edit like any other: it never claims the code is in sync.
    commit(rebased.data, { marksDocAhead: true });
    return ok(step.entry.label);
  }, [closeGesture, peek, historyFor, setHistory, commit]);

  const undo = useCallback(() => travel('undo'), [travel]);
  const redo = useCallback(() => travel('redo'), [travel]);

  const current = history.docId === docId ? history : null;
  const gestureOpen = docId !== null && openGestureDoc === docId;
  const undoDepth = Math.min((current?.past.length ?? 0) + (gestureOpen ? 1 : 0), EDIT_HISTORY_LIMIT);
  return {
    doc, isDirty, isSaving, saveError, stage, stageDebounced, commit, flush, retry, dismissError, peek,
    edit, undo, redo,
    canUndo: undoDepth > 0,
    // An open gesture forks history the moment it closes, so redo is already gone.
    canRedo: !gestureOpen && (current?.future.length ?? 0) > 0,
    undoDepth,
    undoLabel: current?.past.at(-1)?.label ?? null,
    redoLabel: current?.future.at(-1)?.label ?? null,
  };
}
