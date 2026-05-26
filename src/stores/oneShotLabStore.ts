'use client';

import { create } from 'zustand';

export interface OneShotPendingNav {
  catalogId: string;
  entityId: string;
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
