'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import {
  deleteObjectScript,
  duplicateObjectScript,
} from '@/lib/blender-mcp/scripts/scene-objects';
import type { SceneInfo } from '@/lib/blender-mcp/types';

interface SceneComposerState {
  sceneInfo: SceneInfo | null;
  selectedObject: string | null;
  isRefreshing: boolean;
  /** Reason the last scene refresh failed, or null when it succeeded. */
  lastError: string | null;
  /**
   * Reason the last object OPERATION (delete/duplicate) failed, or null.
   *
   * Separate from `lastError` because the tree renders that one as "Scene
   * refresh failed: …"; a destructive delete that never happened must not be
   * reported as a refresh problem. Held distinctly so both can be true at once.
   */
  actionError: string | null;
  /** Which operation produced `actionError`, so the banner can offer a real retry. */
  failedAction: { op: 'delete' | 'duplicate'; name: string } | null;
  /** What the last successful object operation reported, for confirmation. */
  actionResult: string | null;
  /** True once at least one refresh has completed (success or failure). */
  hasRefreshed: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';

  refreshScene: () => Promise<void>;
  selectObject: (name: string | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  deleteObject: (name: string) => Promise<void>;
  duplicateObject: (name: string) => Promise<void>;
  clearActionFeedback: () => void;
}

export const useSceneComposerStore = create<SceneComposerState>()(
  (set, get) => ({
    sceneInfo: null,
    selectedObject: null,
    isRefreshing: false,
    lastError: null,
    actionError: null,
    failedAction: null,
    actionResult: null,
    hasRefreshed: false,
    transformMode: 'translate',

    refreshScene: async () => {
      set({ isRefreshing: true });
      const result = await tryApiFetch<SceneInfo>('/api/blender-mcp/scene');
      if (result.ok) {
        set({ sceneInfo: result.data, isRefreshing: false, lastError: null, hasRefreshed: true });
      } else {
        // Never swallow the failure into a fake "no scene" empty state — keep the
        // last known scene and surface why the refresh failed (fleet a11y convention).
        set({ isRefreshing: false, lastError: result.error, hasRefreshed: true });
      }
    },

    selectObject: (name) => set({ selectedObject: name }),

    setTransformMode: (mode) => set({ transformMode: mode }),

    /**
     * Run one object operation and REPORT it.
     *
     * Both callers used to `await tryApiFetch(...)` and throw the Result away,
     * twelve lines under this store's own comment about never swallowing a
     * failure — so confirming a destructive delete gave zero feedback whether
     * the object was removed, never found, or Blender was offline. Dispatch now
     * goes through the one `executeViaMCP` wrapper (which also lands the script
     * in the Script History panel), and the outcome is written to state either
     * way. A failure does NOT refresh: refreshing on a failed delete is exactly
     * the "tree looks identical" symptom.
     */
    deleteObject: async (name) => {
      set({ actionError: null, actionResult: null, failedAction: null });
      const result = await executeViaMCP(
        `Delete object: ${name}`,
        deleteObjectScript(name),
      );
      if (!result.ok) {
        set({
          actionError: `Could not delete "${name}": ${result.error}`,
          failedAction: { op: 'delete', name },
        });
        return;
      }
      set({ actionResult: result.data.output.trim() || `Deleted "${name}".` });
      await get().refreshScene();
    },

    duplicateObject: async (name) => {
      set({ actionError: null, actionResult: null, failedAction: null });
      const result = await executeViaMCP(
        `Duplicate object: ${name}`,
        duplicateObjectScript(name),
      );
      if (!result.ok) {
        set({
          actionError: `Could not duplicate "${name}": ${result.error}`,
          failedAction: { op: 'duplicate', name },
        });
        return;
      }
      set({ actionResult: result.data.output.trim() || `Duplicated "${name}".` });
      await get().refreshScene();
    },

    clearActionFeedback: () =>
      set({ actionError: null, actionResult: null, failedAction: null }),
  }),
);
