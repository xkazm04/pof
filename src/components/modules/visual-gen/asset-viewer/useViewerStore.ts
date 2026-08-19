import { create } from 'zustand';
import { type AssetStats, type AssetBudget, DEFAULT_UE5_PROP_BUDGET } from './assetStats';
import type { ViewerLoadState } from './loadStatus';

export type RenderMode = 'textured' | 'solid' | 'wireframe';
export type { ViewerLoadState };

interface ViewerState {
  /** Object URL of the currently loaded model (null = no model loaded) */
  modelUrl: string | null;
  /** Original filename of the loaded model */
  modelName: string | null;
  renderMode: RenderMode;
  showGrid: boolean;
  showAxes: boolean;
  autoRotate: boolean;
  /** Geometry/material/texture stats for the loaded model (null until computed). */
  stats: AssetStats | null;
  /** Active UE5 budget the inspector checks the loaded model against. */
  budget: AssetBudget;
  /** Which of idle / loading / loaded / error is true of {@link modelUrl} right now. */
  loadState: ViewerLoadState;
  /** Why the load failed, when it did. Null in every other state. */
  loadError: string | null;

  setModel: (url: string | null, name?: string | null) => void;
  setRenderMode: (mode: RenderMode) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleAutoRotate: () => void;
  /** A load finished. Ignored when `url` is no longer the model on screen. */
  reportLoaded: (url: string, stats: AssetStats) => void;
  /** A load failed. Ignored when `url` is no longer the model on screen. */
  reportLoadError: (url: string, message: string) => void;
  /** The model was unmounted — its numbers describe nothing now. */
  clearStats: () => void;
  setBudget: (budget: AssetBudget) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  modelUrl: null,
  modelName: null,
  renderMode: 'textured' as RenderMode,
  showGrid: true,
  showAxes: true,
  autoRotate: false,
  stats: null as AssetStats | null,
  budget: DEFAULT_UE5_PROP_BUDGET,
  loadState: 'idle' as ViewerLoadState,
  loadError: null as string | null,
};

export const useViewerStore = create<ViewerState>((set) => ({
  ...INITIAL_STATE,

  /**
   * Point the viewer at a model.
   *
   * Clears `stats` in the SAME set as the name change: the previous model's triangle
   * count describes the previous model, and a 42 MB mesh takes seconds to resolve, so
   * leaving it behind put A's numbers under B's name for the whole window. A URL implies
   * `loading` — "asked for and not here yet" is never `idle`.
   */
  setModel: (url, name = null) =>
    set({
      modelUrl: url,
      modelName: name,
      stats: null,
      loadState: url ? 'loading' : 'idle',
      loadError: null,
    }),
  setRenderMode: (mode) => set({ renderMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),

  // Both reports are keyed on the URL they belong to: loads are not cancellable, so a
  // superseded 42 MB fetch WILL land late, and applying it would re-open the exact lie
  // setModel just closed.
  reportLoaded: (url, stats) =>
    set((s) => (s.modelUrl !== url ? s : { stats, loadState: 'loaded' as ViewerLoadState, loadError: null })),
  reportLoadError: (url, message) =>
    set((s) =>
      s.modelUrl !== url ? s : { stats: null, loadState: 'error' as ViewerLoadState, loadError: message },
    ),
  clearStats: () => set({ stats: null }),

  setBudget: (budget) => set({ budget }),
  reset: () => set(INITIAL_STATE),
}));
