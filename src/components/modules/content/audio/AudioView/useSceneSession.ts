'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneDraft } from '@/lib/audio-scene-ops';
import type { AudioSceneDocument, UpdateAudioScenePayload } from '@/types/audio-scene';
import { useSceneBuffer, type SceneBuffer } from './useSceneBuffer';

/**
 * The ONE edit session of the open audio scene, owned by AudioView so every tab
 * writes through it and every exit settles against the scene the edit was made in.
 *
 * `useSceneBuffer` used to be mounted inside PainterTab, so the Soundscapes tab
 * wrote zones through its own `activeDoc`-built writer (reverting an unconfirmed
 * drag) and a scene switch stranded the painter's buffered ops. Here the buffer
 * lives one level up — unchanged — and the session adds the exits:
 *   - `requestSwitch` flushes the open scene first and switches only once the
 *     write is confirmed; a failed write HOLDS the switch (Retry / Discard);
 *   - `settle` writes what is buffered and returns the scene as the user sees it
 *     (what a Generate prompt must be built from).
 */
export interface SceneSession {
  /** The open scene's op buffer (zones + emitters) — painter and soundscapes share it. */
  buffer: SceneBuffer;
  /** Scene the user asked for while the open scene's edit was still being written. */
  pendingSwitch: number | null;
  /** The held switch is blocked by a refused write: the user must Retry or Discard. */
  switchBlocked: boolean;
  requestSwitch: (id: number) => void;
  /** Re-send the refused ops; the held switch completes once they are saved. */
  retrySwitch: () => void;
  /** Drop the refused ops and complete the held switch. */
  discardAndSwitch: () => void;
  /** Write whatever is buffered now; the open doc with the buffered scene applied. */
  settle: () => AudioSceneDocument | null;
}

export interface SceneSessionOptions {
  activeDoc: AudioSceneDocument | null;
  /** The THROWING write (`useAudioScene.commitDoc`). */
  commitDoc: (payload: UpdateAudioScenePayload) => Promise<unknown>;
  /** Make `id` the open scene (and reset whatever selection belongs to the old one). */
  switchTo: (id: number) => void;
}

export function useSceneSession({ activeDoc, commitDoc, switchTo }: SceneSessionOptions): SceneSession {
  // Bumped by Discard: the refused ops stay keyed to the old epoch, so they are
  // never rendered or written again — without touching the buffer's API.
  const [epoch, setEpoch] = useState(0);
  const [pendingSwitch, setPendingSwitch] = useState<number | null>(null);
  // Counts writes that actually started, so a flush that found nothing to send is told apart.
  const writesStarted = useRef(0);

  const docId = activeDoc?.id ?? null;
  const zones = activeDoc?.zones;
  const emitters = activeDoc?.emitters;
  const base = useMemo<SceneDraft | null>(
    () => (zones && emitters ? { zones, emitters } : null),
    [zones, emitters],
  );

  // Bound to the scene of THIS render: a flush issued before a switch writes the
  // scene its ops were made in, never the one being switched to.
  const write = useCallback(async (next: SceneDraft) => {
    if (docId === null) return;
    writesStarted.current++;
    await commitDoc({ id: docId, zones: next.zones, emitters: next.emitters });
  }, [docId, commitDoc]);

  const buffer = useSceneBuffer({
    base,
    sceneId: docId === null ? null : `${docId}:${epoch}`,
    write,
    flushOnUnmount: true,
  });
  const { flush, isSaving, isDirty, saveError, retry, dismissError, peek } = buffer;

  /** Flush; true when that started a write the switch must wait for. */
  const flushStartedWrite = useCallback(() => {
    const before = writesStarted.current;
    flush();
    return writesStarted.current !== before;
  }, [flush]);

  const requestSwitch = useCallback((id: number) => {
    if (id === docId) { setPendingSwitch(null); return; }
    if (saveError) { setPendingSwitch(id); return; }
    if (!flushStartedWrite() && !isSaving) {
      setPendingSwitch(null);
      switchTo(id);
      return;
    }
    setPendingSwitch(id);
  }, [docId, saveError, flushStartedWrite, isSaving, switchTo]);

  // A held switch completes on the render that shows the open scene's write
  // confirmed (nothing saving, nothing buffered, no refusal). It is a pure state
  // transition, so it runs while rendering — React's "adjust state when a value
  // changes" pattern — which is why `switchTo` must set state of the component
  // calling this hook (AudioView). A refused write leaves it held (`switchBlocked`).
  const waiting = pendingSwitch !== null && !isSaving && !saveError;
  if (waiting && !isDirty) {
    setPendingSwitch(null);
    switchTo(pendingSwitch);
  }

  // Edits typed while the switch waited are written first; it completes after.
  useEffect(() => {
    if (waiting && isDirty) flush();
  }, [waiting, isDirty, flush]);

  const discardAndSwitch = useCallback(() => {
    if (pendingSwitch === null) return;
    setEpoch((e) => e + 1);
    dismissError();
    setPendingSwitch(null);
    switchTo(pendingSwitch);
  }, [pendingSwitch, dismissError, switchTo]);

  const settle = useCallback((): AudioSceneDocument | null => {
    if (!activeDoc) return null;
    flush();
    const scene = peek();
    return scene ? { ...activeDoc, zones: scene.zones, emitters: scene.emitters } : activeDoc;
  }, [activeDoc, flush, peek]);

  return {
    buffer,
    pendingSwitch,
    switchBlocked: pendingSwitch !== null && saveError !== null,
    requestSwitch,
    retrySwitch: retry,
    discardAndSwitch,
    settle,
  };
}
