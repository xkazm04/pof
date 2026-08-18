'use client';

import { useCallback, useRef } from 'react';
import type { LevelDesignDocument, UpdateDocPayload } from '@/types/level-design';
import { useEntityCommitBuffer } from '@/hooks/useEntityCommitBuffer';
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

const applyPatch = (doc: LevelDesignDocument, patch: DocPatch): LevelDesignDocument => ({ ...doc, ...patch });
const foldPatch = (prev: DocPatch | null, next: DocPatch): DocPatch => ({ ...(prev ?? {}), ...next });
const isEmptyPatch = (patch: DocPatch): boolean => Object.keys(patch).length === 0;

/**
 * The level-design face of the shared `useEntityCommitBuffer`.
 *
 * Every level-design edit used to be a PUT + a full re-GET: a node drag wrote
 * ~60 times a second and a typed sentence wrote once per character, each round
 * trip blanking the editor and re-echoing a controlled value back into the
 * textarea (dropped characters, lost focus). The shared buffer supplies the
 * stage/debounce/commit engine; this adapter supplies the two level-design
 * specifics — the `Result`-returning PUT (which must become a rejection so a
 * failure is distinguishable from a save) and the one-flip-per-commit
 * `doc-ahead` escalation.
 */
export function useDocCommitBuffer({ baseDoc, updateDoc }: UseDocCommitBufferArgs): DocCommitBuffer {
  const marksDocAheadRef = useRef(false);

  // One flip per committed change. An explicit syncStatus in the patch (e.g. the
  // codegen callback marking the doc `synced`) always wins over the escalation.
  const finalize = useCallback((patch: DocPatch, doc: LevelDesignDocument): DocPatch => {
    if (patch.syncStatus === undefined && marksDocAheadRef.current && doc.syncStatus === 'synced') {
      return { ...patch, syncStatus: 'doc-ahead' };
    }
    return patch;
  }, []);

  const write = useCallback(async (patch: DocPatch, doc: LevelDesignDocument) => {
    const result = await updateDoc({ id: doc.id, ...patch });
    // The buffer treats a resolve as "the server has it"; a failed PUT must reject.
    if (!result.ok) throw new Error(result.error);
  }, [updateDoc]);

  const onCommitted = useCallback(() => { marksDocAheadRef.current = false; }, []);

  const {
    doc, isDirty, isSaving, saveError,
    stage: stageBuffer,
    stageDebounced: stageDebouncedBuffer,
    commit: commitBuffer,
    flush, retry, dismissError,
  } = useEntityCommitBuffer<LevelDesignDocument, DocPatch>({
    base: baseDoc,
    entityId: baseDoc?.id ?? null,
    apply: applyPatch,
    fold: foldPatch,
    isEmpty: isEmptyPatch,
    finalize,
    commit: write,
    onCommitted,
    flushOnUnmount: true,
    errorMessage: 'Could not save the document.',
  });

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

  return { doc, isDirty, isSaving, saveError, stage, stageDebounced, commit, flush, retry, dismissError };
}
