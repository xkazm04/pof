import { create } from 'zustand';

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

  setModel: (url: string | null, name?: string | null) => void;
  setRenderMode: (mode: RenderMode) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleAutoRotate: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  modelUrl: null,
  modelName: null,
  renderMode: 'textured' as RenderMode,
  showGrid: true,
  showAxes: true,
  autoRotate: false,
};

export const useViewerStore = create<ViewerState>((set) => ({
  ...INITIAL_STATE,

  setModel: (url, name = null) => set({ modelUrl: url, modelName: name }),
  setRenderMode: (mode) => set({ renderMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  reset: () => set(INITIAL_STATE),
}));
