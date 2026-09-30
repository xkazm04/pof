'use client';

import { useCallback, useMemo } from 'react';
import { useEntityCommitBuffer, type EntityKey } from '@/hooks/useEntityCommitBuffer';
import { applySceneOps, foldSceneOps, type SceneDraft, type SceneOp } from '@/lib/audio-scene-ops';
import { patchOf, type RecordCommit } from '@/components/modules/content/audio/AudioPropertyPanel/useRecordCommit';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * The ONE optimistic edit buffer of an audio scene, shared by the painter
 * canvas and the property panels.
 *
 * Before this there were two, and neither could see the other: the painter held
 * a whole-scene SNAPSHOT (a failed drag kept it, hid every later server change
 * and overwrote it on Retry), and each panel held a per-record buffer whose
 * write was built from the server copy (so a rename reverted an unsaved drag).
 *
 * Here the buffered patch is a LIST OF OPS (`SceneOp`). The render is the
 * server scene with the ops replayed (`applySceneOps`), and every write replays
 * the same list onto the NEWEST server copy — so no edit, from either surface,
 * can revert another. The cadence rules are `useEntityCommitBuffer`'s: stage
 * (drag frames, zero writes), stageDebounced (typing), commit (mouseup, a click).
 */
export interface SceneBuffer {
  /** Server scene with every buffered op replayed — what the canvas and panels render. */
  scene: SceneDraft | null;
  /** Buffered ops have not yet been confirmed by the server. */
  isDirty: boolean;
  isSaving: boolean;
  /** Set when a write FAILED. The ops are kept, so `retry()` re-sends them rebased. */
  saveError: string | null;
  /** Local only, zero writes — a drag's mouse-move frames. */
  stage: (ops: SceneOp[]) => void;
  /** Local now, one write after the typing/drag pause. */
  stageDebounced: (ops: SceneOp[]) => void;
  /** Local now, write now (with no argument: write what is buffered). */
  commit: (ops?: SceneOp[]) => void;
  /** Write whatever is buffered right now (blur, slider release). */
  flush: () => void;
  retry: () => void;
  /** Hide the banner; the ops are kept (dismissing is not discarding). */
  dismissError: () => void;
  /** The rendered scene read from refs — for handlers mid-gesture. */
  peek: () => SceneDraft | null;
}

export interface SceneBufferOptions {
  /** The server's copy of the scene (`null` when none is open). */
  base: SceneDraft | null;
  /** Identity of `base` — ops staged against another scene are never written. */
  sceneId?: EntityKey;
  /**
   * Persist the whole rebased scene. MUST reject when the server refused it.
   * `base` is the server copy the ops were replayed onto.
   */
  write: (next: SceneDraft, base: SceneDraft) => void | Promise<unknown>;
  /** Write buffered ops when the host unmounts (tab switch). Default `false`. */
  flushOnUnmount?: boolean;
}

const noOps = (ops: SceneOp[]) => ops.length === 0;

export function useSceneBuffer({ base, sceneId = null, write, flushOnUnmount = false }: SceneBufferOptions): SceneBuffer {
  const commitOps = useCallback(
    async (ops: SceneOp[], server: SceneDraft) => { await write(applySceneOps(server, ops), server); },
    [write],
  );

  const buf = useEntityCommitBuffer<SceneDraft, SceneOp[]>({
    base,
    entityId: sceneId,
    apply: applySceneOps,
    fold: foldSceneOps,
    isEmpty: noOps,
    commit: commitOps,
    flushOnUnmount,
    errorMessage: 'Could not save the scene change.',
  });

  return useMemo(() => ({
    scene: buf.doc,
    isDirty: buf.isDirty,
    isSaving: buf.isSaving,
    saveError: buf.saveError,
    stage: buf.stage,
    stageDebounced: buf.stageDebounced,
    commit: buf.commit,
    flush: buf.flush,
    retry: buf.retry,
    dismissError: buf.dismissError,
    peek: buf.peek,
  }), [buf]);
}

/**
 * A property panel's view of ONE record inside the shared buffer: it renders the
 * record as the buffer has it and writes through the same op list, so the canvas
 * redraws a slider drag on the same frame and a panel write carries any buffered
 * gesture with it. `error` is `null` on purpose — the buffer is one, so its
 * failure has one banner (the painter's), and one Retry re-sends everything.
 */
function useSceneRecord<T extends { id: string }>(
  buffer: SceneBuffer,
  record: T | null,
  toOp: (id: string, patch: Partial<T>) => SceneOp,
): RecordCommit<T> | null {
  const { stageDebounced, commit, flush, retry, dismissError, isDirty } = buffer;
  return useMemo(() => {
    if (!record) return null;
    return {
      value: record,
      isPending: isDirty,
      error: null,
      edit: <K extends keyof T>(key: K, value: T[K]) => stageDebounced([toOp(record.id, patchOf<T, K>(key, value))]),
      pick: <K extends keyof T>(key: K, value: T[K]) => commit([toOp(record.id, patchOf<T, K>(key, value))]),
      release: flush,
      retry,
      dismissError,
    };
  }, [record, isDirty, stageDebounced, commit, flush, retry, dismissError, toOp]);
}

const zoneOp = (id: string, patch: Partial<AudioZone>): SceneOp => ({ kind: 'patchZone', id, patch });
const emitterOp = (id: string, patch: Partial<SoundEmitter>): SceneOp => ({ kind: 'patchEmitter', id, patch });

/** The selected zone as a scene-backed record (`null` when none is, or it is gone). */
export function useSceneZone(buffer: SceneBuffer, id: string | null): RecordCommit<AudioZone> | null {
  const zone = useMemo(() => (id ? buffer.scene?.zones.find((z) => z.id === id) ?? null : null), [buffer.scene, id]);
  return useSceneRecord(buffer, zone, zoneOp);
}

/** The selected emitter as a scene-backed record. */
export function useSceneEmitter(buffer: SceneBuffer, id: string | null): RecordCommit<SoundEmitter> | null {
  const emitter = useMemo(
    () => (id ? buffer.scene?.emitters.find((e) => e.id === id) ?? null : null),
    [buffer.scene, id],
  );
  return useSceneRecord(buffer, emitter, emitterOp);
}
