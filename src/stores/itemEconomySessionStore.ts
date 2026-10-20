'use client';

import { create } from 'zustand';
import { DEFAULT_ITEM_ECON_CONFIG, runItemEconomySim, type ItemEconomyConfig } from '@/lib/economy/item-economy-engine';
import { runToCoverage, HORIZON_LADDER } from '@/lib/economy/item-economy-verdicts';
import {
  createSession, reduceSession,
  type ItemEconomyAction, type ItemEconomySession,
} from '@/lib/economy/item-economy-session';

export type ItemEconomyRunKind = 'run' | 'extend';

interface ItemEconomySessionStore extends ItemEconomySession {
  dispatch: (action: ItemEconomyAction) => void;
  updateConfig: <K extends keyof ItemEconomyConfig>(key: K, value: ItemEconomyConfig[K]) => void;
  /** Mark a run as started; returns the ticket to hand to `execute`. */
  start: () => number;
  /** Do the synchronous Monte Carlo work for a started run and record the outcome. */
  execute: (runId: number, kind: ItemEconomyRunKind) => void;
  run: () => void;
  extend: () => void;
  reset: () => void;
}

/**
 * Session-lifetime (not persisted) Item Economy run, so the result survives the
 * Item Catalog sub-tab unmounting and the Balance Advisor can quote it.
 */
export const useItemEconomySessionStore = create<ItemEconomySessionStore>((set, get) => ({
  ...createSession({ ...DEFAULT_ITEM_ECON_CONFIG }),
  dispatch: (action) => set((s) => reduceSession(s, action)),
  updateConfig: (key, value) =>
    get().dispatch({ type: 'setConfig', config: { ...get().config, [key]: value } }),
  start: () => {
    get().dispatch({ type: 'start' });
    return get().runId;
  },
  execute: (runId, kind) => {
    const { dispatch, config } = get();
    try {
      if (kind === 'run') {
        dispatch({ type: 'finish', runId, result: runItemEconomySim(config) });
        return;
      }
      // Walk the horizon ladder at the same seed; adopt the smallest horizon that samples the endgame.
      const covered = runToCoverage(config);
      if (covered) {
        dispatch({
          type: 'finish', runId, result: covered.result,
          extendNote: `extended to ${covered.horizon} h, the first rung that samples the endgame`,
        });
      } else {
        dispatch({
          type: 'finish', runId, result: null,
          extendNote: `endgame not reached within ${HORIZON_LADDER[HORIZON_LADDER.length - 1]} h; lower Max Level`,
        });
      }
    } catch (e) {
      dispatch({ type: 'fail', runId, message: e instanceof Error ? e.message : String(e) });
    }
  },
  run: () => get().execute(get().start(), 'run'),
  extend: () => get().execute(get().start(), 'extend'),
  reset: () => set(createSession({ ...DEFAULT_ITEM_ECON_CONFIG })),
}));
