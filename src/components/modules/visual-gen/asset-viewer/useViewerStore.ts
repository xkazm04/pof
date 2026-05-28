import { create } from 'zustand';
import { type AssetStats, type AssetBudget, DEFAULT_UE5_PROP_BUDGET } from './assetStats';

export type RenderMode = 'textured' | 'solid' | 'wireframe';

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

  setModel: (url: string | null, name?: string | null) => void;
  setRenderMode: (mode: RenderMode) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleAutoRotate: () => void;
  setStats: (stats: AssetStats | null) => void;
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
};

export const useViewerStore = create<ViewerState>((set) => ({
  ...INITIAL_STATE,

  setModel: (url, name = null) => set({ modelUrl: url, modelName: name }),
  setRenderMode: (mode) => set({ renderMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  setStats: (stats) => set({ stats }),
  setBudget: (budget) => set({ budget }),
  reset: () => set(INITIAL_STATE),
}));
