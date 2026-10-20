import type { ItemEconomyConfig, ItemEconomyResult } from './item-economy-engine';

/**
 * Pure state machine for one Item Economy Simulator session. The previous
 * result is retained through running and error so a failed or in-flight rerun
 * never blanks the evidence the Balance Advisor quotes.
 */
export type ItemEconomyStatus = 'idle' | 'running' | 'ready' | 'error';

export interface ItemEconomySession {
  status: ItemEconomyStatus;
  config: ItemEconomyConfig;
  /** Latest successful result (kept while a rerun is in flight or after it failed). */
  result: ItemEconomyResult | null;
  /** Set only when status is 'error'. */
  error: string | null;
  /** Count of completed runs; also the ticket a running run must present to finish. */
  runId: number;
  extendNote: string | null;
}

export type ItemEconomyAction =
  | { type: 'start' }
  | { type: 'finish'; runId: number; result: ItemEconomyResult | null; extendNote?: string | null }
  | { type: 'fail'; runId: number; message: string }
  | { type: 'setConfig'; config: ItemEconomyConfig };

export function createSession(config: ItemEconomyConfig): ItemEconomySession {
  return { status: 'idle', config, result: null, error: null, runId: 0, extendNote: null };
}

export function reduceSession(state: ItemEconomySession, action: ItemEconomyAction): ItemEconomySession {
  switch (action.type) {
    case 'start':
      if (state.status === 'running') return state;
      return { ...state, status: 'running', error: null, extendNote: null };
    case 'finish':
      if (state.status !== 'running' || action.runId !== state.runId) return state;
      if (action.result) {
        return {
          ...state, status: 'ready', error: null, runId: state.runId + 1,
          result: action.result, config: action.result.config, extendNote: action.extendNote ?? null,
        };
      }
      // No new result (endgame never reached): keep the previous one, surface the note.
      return { ...state, status: state.result ? 'ready' : 'idle', error: null, runId: state.runId + 1, extendNote: action.extendNote ?? null };
    case 'fail':
      if (state.status !== 'running' || action.runId !== state.runId) return state;
      return { ...state, status: 'error', error: action.message };
    case 'setConfig':
      return { ...state, config: action.config };
  }
}

/**
 * The bracket level the advisor should quote: the deepest level any simulated
 * agent reached. A fixed level can sit past what the run's horizon sampled
 * (the defaults never reach Lv14), which would leave the rarity UNMEASURED.
 */
export function evidenceLevel(result: ItemEconomyResult | null, fallback = 14): number {
  if (!result) return fallback;
  let best = 0;
  for (const b of result.brackets) if (b.agentsReached > 0 && b.level > best) best = b.level;
  return best > 0 ? best : fallback;
}
