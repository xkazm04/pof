'use client';

/**
 * The ACTIVE game — which workspace the lab and /status show (spark gtai-uprising-project).
 *
 * Two sources, one rule: the URL `g` param WINS on arrival (`/?g=gtai…`, `/status?g=gtai`); an
 * invalid or absent `g` falls back to this store, which remembers the last choice
 * (`pof-active-game`). Choosing a game rewrites `g` with `replaceState` — never a push, so a
 * game switch is not a history step — and every other param (the lab address `c/e/s/v`,
 * /status's `tab`/`entity`) is kept.
 *
 * Reads go through `useActiveGame()`, which serves the DEFAULT game until hydration so the
 * server render and the first client render agree (the persisted value would otherwise differ
 * on the first frame — the same gate `useLabPrefs` uses). `showAllPipelines` is a remembered
 * view preference, not transient state.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameDef, GameId } from '@/lib/games/types';
import { DEFAULT_GAME, GAMES, isGameId } from '@/lib/games/registry';

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
    {
      name: 'pof-active-game',
      partialize: (s) => ({ gameId: s.gameId, showAllPipelines: s.showAllPipelines }),
      // A hand-edited / stale blob naming an unregistered game must not reach the views.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ActiveGameState>;
        return {
          ...current,
          gameId: isGameId(p.gameId) ? p.gameId : current.gameId,
          showAllPipelines: p.showAllPipelines === true,
        };
      },
    },
  ),
);

/** The URL param that names the active game. */
export const GAME_PARAM = 'g';

/** The game `search` names, or `null` for an absent / unregistered value (which never wins). */
export function parseGameParam(search: string): GameId | null {
  const g = new URLSearchParams(search).get(GAME_PARAM);
  return isGameId(g) ? g : null;
}

/**
 * The address to write so the URL names `gameId`, or `null` when it already does. `href`'s
 * path, hash and every other param are kept. An absent `g` with the DEFAULT game is left
 * absent, so PoF's addresses stay exactly what they were before games existed.
 */
export function gameUrl(href: string, gameId: GameId): string | null {
  const url = new URL(href);
  const current = url.searchParams.get(GAME_PARAM);
  if (current === gameId) return null;
  if (current === null && gameId === DEFAULT_GAME) return null;
  url.searchParams.set(GAME_PARAM, gameId);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The game arrival lands on: a valid URL `g` wins, else the remembered one. Pure. */
export function arrivalGame(search: string, stored: GameId): GameId {
  return parseGameParam(search) ?? stored;
}

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export interface ActiveGame {
  gameId: GameId;
  game: GameDef;
  showAllPipelines: boolean;
  hydrated: boolean;
}

/** Hydration-safe read of the active game (DEFAULT until the client has hydrated). */
export function useActiveGame(): ActiveGame {
  const hydrated = useHydrated();
  const stored = useActiveGameStore((s) => s.gameId);
  const storedShowAll = useActiveGameStore((s) => s.showAllPipelines);
  const gameId = hydrated ? stored : DEFAULT_GAME;
  return { gameId, game: GAMES[gameId], showAllPipelines: hydrated && storedShowAll, hydrated };
}

function writeGame(gameId: GameId): void {
  const next = gameUrl(window.location.href, gameId);
  if (next) window.history.replaceState(window.history.state, '', next);
}

/**
 * Bind the URL `g` param and the store. Call ONCE per surface (the lab shell, /status).
 * Arrival: a valid `g` is adopted; an invalid one is rewritten to the remembered game. After
 * that every game change rewrites `g` in place (replace, not push).
 */
export function useActiveGameUrlSync(): void {
  useEffect(() => {
    const st = useActiveGameStore.getState();
    const target = arrivalGame(window.location.search, st.gameId);
    if (target !== st.gameId) st.setGame(target);
    else writeGame(target);
    const unsubscribe = useActiveGameStore.subscribe((s, prev) => {
      if (s.gameId !== prev.gameId) writeGame(s.gameId);
    });
    // Back/Forward onto an entry written under another game re-adopts that entry's game.
    const onPop = () => {
      const g = parseGameParam(window.location.search);
      const current = useActiveGameStore.getState().gameId;
      if (g && g !== current) useActiveGameStore.getState().setGame(g);
      // An entry with no (or an unregistered) g keeps the current game: rewrite the address to name it.
      else if (!g) writeGame(current);
    };
    window.addEventListener('popstate', onPop);
    return () => { unsubscribe(); window.removeEventListener('popstate', onPop); };
  }, []);
}
