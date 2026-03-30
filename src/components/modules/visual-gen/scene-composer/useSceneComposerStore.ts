'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { SceneInfo, ExecuteOutput } from '@/lib/blender-mcp/types';

interface SceneComposerState {
  sceneInfo: SceneInfo | null;
  selectedObject: string | null;
  isRefreshing: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';

  refreshScene: () => Promise<void>;
  selectObject: (name: string | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  deleteObject: (name: string) => Promise<void>;
  duplicateObject: (name: string) => Promise<void>;
}

export const useSceneComposerStore = create<SceneComposerState>()(
  (set, get) => ({
    sceneInfo: null,
    selectedObject: null,
    isRefreshing: false,
    transformMode: 'translate',

    refreshScene: async () => {
      set({ isRefreshing: true });
      const result = await tryApiFetch<SceneInfo>('/api/blender-mcp/scene');
      if (result.ok) {
        set({ sceneInfo: result.data, isRefreshing: false });
      } else {
        set({ isRefreshing: false });
      }
    },

    selectObject: (name) => set({ selectedObject: name }),

    setTransformMode: (mode) => set({ transformMode: mode }),

    deleteObject: async (name) => {
      const code = `import bpy\nobj = bpy.data.objects.get("${name.replace(/"/g, '\\"')}")\nif obj:\n    bpy.data.objects.remove(obj, do_unlink=True)`;
      await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      get().refreshScene();
    },

    duplicateObject: async (name) => {
      const code = `import bpy\nobj = bpy.data.objects.get("${name.replace(/"/g, '\\"')}")\nif obj:\n    new = obj.copy()\n    new.data = obj.data.copy()\n    bpy.context.collection.objects.link(new)`;
      await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      get().refreshScene();
    },
  }),
);
