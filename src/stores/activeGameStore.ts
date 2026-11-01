'use client';

/**
 * The ACTIVE game — which workspace the lab and /status show. The URL `g` param wins on arrival;
 * this store remembers the last choice. STUB (wire commit): WP2 adds URL sync and the selector.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameId } from '@/lib/games/types';
import { DEFAULT_GAME } from '@/lib/games/registry';

export interface ActiveGameState {
  gameId: GameId;
  /** Reveal off-manifest pipelines (greyed, "not in <game>"). */
  showAllPipelines: boolean;
  setGame: (id: GameId) => void;
  setShowAllPipelines: (v: boolean) => void;
}

export const useActiveGameStore = create<ActiveGameState>()(
  persist(
    (set) => ({
      gameId: DEFAULT_GAME,
      showAllPipelines: false,
      setGame: (gameId) => set({ gameId }),
      setShowAllPipelines: (showAllPipelines) => set({ showAllPipelines }),
    }),
    { name: 'pof-active-game', partialize: (s) => ({ gameId: s.gameId, showAllPipelines: s.showAllPipelines }) },
  ),
);
