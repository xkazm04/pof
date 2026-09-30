'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import {
  toDressPlan,
  type DressPlan,
  type SceneDecomposeData,
} from '@/lib/visual-gen/scene-dress-plan';
import {
  blockoutScriptName,
  compositionBlockoutScript,
  readBlockoutReceipt,
} from '@/lib/blender-mcp/scripts/composition-blockout';
import { useSceneComposerStore } from './useSceneComposerStore';

/**
 * "Dress from image" — the scene-decompose route's first operator surface.
 *
 * Two explicit clicks, nothing spent before them: picking an image only reads it locally;
 * Decompose is the paid vision call (plus one per prop when crop gating is on — sent
 * EXPLICITLY, because the route gates by default); Block out dispatches through the one
 * Blender dispatcher and believes only the receipt Blender prints.
 */
export type SceneDressStatus =
  | 'idle'
  | 'decomposing'
  | 'planned'
  | 'empty'
  | 'failed'
  | 'building'
  | 'built'
  | 'build-failed'
  | 'unconfirmed';

interface SceneDressState {
  imageDataUrl: string | null;
  imageName: string | null;
  gateCrops: boolean;
  status: SceneDressStatus;
  plan: DressPlan | null;
  /** Why decompose failed. */
  error: string | null;
  /** The route's note on an honest empty answer. */
  note: string | null;
  /** Why the last blockout failed or could not be confirmed. */
  buildError: string | null;
  /** What Blender confirmed on the last blockout. */
  builtCount: number | null;

  setImage: (dataUrl: string, name?: string) => void;
  setGateCrops: (on: boolean) => void;
  decompose: () => Promise<void>;
  buildBlockout: () => Promise<void>;
  reset: () => void;
}

const INITIAL = {
  imageDataUrl: null,
  imageName: null,
  gateCrops: false,
  status: 'idle' as SceneDressStatus,
  plan: null,
  error: null,
  note: null,
  buildError: null,
  builtCount: null,
};

const BUSY: ReadonlySet<SceneDressStatus> = new Set(['decomposing', 'building']);

export const useSceneDressStore = create<SceneDressState>()((set, get) => ({
  ...INITIAL,

  setImage: (dataUrl, name) =>
    set({ ...INITIAL, gateCrops: get().gateCrops, imageDataUrl: dataUrl, imageName: name ?? null }),

  setGateCrops: (on) => set({ gateCrops: on }),

  decompose: async () => {
    const { imageDataUrl, gateCrops, status } = get();
    if (!imageDataUrl || BUSY.has(status)) return;
    set({ status: 'decomposing', error: null, note: null, buildError: null, builtCount: null });
    const result = await tryApiFetch<SceneDecomposeData>('/api/visual-gen/scene-decompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, gateCrops }),
    });
    if (!result.ok) {
      set({ status: 'failed', error: result.error, plan: null });
      return;
    }
    const plan = toDressPlan(result.data);
    if (plan.placed.length + plan.unplaced.length === 0) {
      set({ status: 'empty', plan, note: plan.note ?? 'the model found no movable props in this image' });
      return;
    }
    set({ status: 'planned', plan, note: plan.note });
  },

  buildBlockout: async () => {
    const { plan, status } = get();
    if (!plan || plan.placed.length === 0 || BUSY.has(status)) return;
    set({ status: 'building', buildError: null, builtCount: null });
    const expected = plan.placed.length;
    const result = await executeViaMCP(blockoutScriptName(expected), compositionBlockoutScript(plan));
    if (!result.ok) {
      set({ status: 'build-failed', buildError: result.error });
      return;
    }
    const receipt = readBlockoutReceipt(result.data.output ?? '', expected);
    if (receipt.state === 'confirmed') {
      set({ status: 'built', builtCount: receipt.placed });
    } else {
      set({
        status: 'unconfirmed',
        buildError: receipt.reason,
        builtCount: receipt.state === 'mismatch' ? receipt.placed : null,
      });
    }
    // The script ran, so the scene may have changed either way: show the tree as it is.
    await useSceneComposerStore.getState().refreshScene();
  },

  reset: () => set({ ...INITIAL }),
}));
