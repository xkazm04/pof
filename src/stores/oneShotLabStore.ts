'use client';

import { create } from 'zustand';

export interface OneShotPendingNav {
  catalogId: string;
  entityId: string;
  /** Optional: open Baseline directly on this pipeline step (from the GlobalCoach jump). */
  stepIndex?: number;
}

export interface OneShotLabState {
  pendingNavigation: OneShotPendingNav | null;
  panelOpen: boolean;
  setPendingNavigation: (v: OneShotPendingNav | null) => void;
  setPanelOpen: (v: boolean) => void;
}

export const useOneShotLabStore = create<OneShotLabState>((set) => ({
  pendingNavigation: null,
  panelOpen: false,
  setPendingNavigation: (v) => set({ pendingNavigation: v }),
  setPanelOpen: (v) => set({ panelOpen: v }),
}));
