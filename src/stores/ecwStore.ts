'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type EcwL1Tab = 'catalogs' | 'mission-control' | 'live-state';
export type CliRailMode = 'auto' | 'wide' | 'collapsed';

interface EcwState {
  activeL1Tab: EcwL1Tab;
  activeCatalogId: string | null;
  activeEntityId: string | null;
  cliRailMode: CliRailMode;
  isPaletteOpen: boolean;

  setActiveL1Tab: (tab: EcwL1Tab) => void;
  selectEntity: (catalogId: string | null, entityId: string | null) => void;
  toggleCliRail: () => void;
  setPaletteOpen: (open: boolean) => void;
}

const RAIL_CYCLE: Record<CliRailMode, CliRailMode> = {
  auto: 'wide',
  wide: 'collapsed',
  collapsed: 'auto',
};

/**
 * Entity-Centric Workspace shell store. Tracks the new L1 tab + selected
 * catalog/entity + CLI rail mode + command-palette visibility.
 *
 * Separate from the legacy `navigationStore` so the two shells can coexist
 * behind the `?ecw=1` flag without state collisions. Consolidates in Phase 12.
 *
 * Persist `partialize` excludes `isPaletteOpen` (transient runtime state —
 * documented zustand persist gotcha, never persist UI-only booleans).
 */
export const useEcwStore = create<EcwState>()(
  persist(
    (set) => ({
      activeL1Tab: 'catalogs',
      activeCatalogId: null,
      activeEntityId: null,
      cliRailMode: 'auto',
      isPaletteOpen: false,

      setActiveL1Tab: (tab) => set({ activeL1Tab: tab }),
      selectEntity: (catalogId, entityId) => set({ activeCatalogId: catalogId, activeEntityId: entityId }),
      toggleCliRail: () => set((s) => ({ cliRailMode: RAIL_CYCLE[s.cliRailMode] })),
      setPaletteOpen: (open) => set({ isPaletteOpen: open }),
    }),
    {
      name: 'ecw-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeL1Tab: s.activeL1Tab,
        activeCatalogId: s.activeCatalogId,
        activeEntityId: s.activeEntityId,
        cliRailMode: s.cliRailMode,
      }),
    },
  ),
);
