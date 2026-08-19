import { create } from 'zustand';
import type { AssetClass } from '@/lib/visual-gen/polycount-presets';
import type { AssetStats } from './assetStats';
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
  /**
   * The asset class the USER stated for the loaded mesh — the input the triangle and
   * size grades resolve through. Null until stated, and never inferred from a filename:
   * `warrior.glb` is not evidence, and a wrong guess grades a character against a prop
   * ceiling. Null grades `unmeasured`, never "within budget".
   */
  assetClass: AssetClass | null;
  /**
   * The longest extent (m) this mesh was SUPPOSED to be, when the user states one. Null
   * falls back to `world-scale`'s nominal for the class, which exists only where it is
   * honest (a character = the 1.8 m UE5 Mannequin; a prop can be a coin or a wagon).
   */
  targetExtentM: number | null;
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
  setAssetClass: (assetClass: AssetClass | null) => void;
  setTargetExtentM: (targetExtentM: number | null) => void;
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
  assetClass: null as AssetClass | null,
  targetExtentM: null as number | null,
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

  setAssetClass: (assetClass) => set({ assetClass }),
  setTargetExtentM: (targetExtentM) => set({ targetExtentM }),
  reset: () => set(INITIAL_STATE),
}));
