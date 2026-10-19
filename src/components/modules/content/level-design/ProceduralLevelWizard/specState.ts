/**
 * The procgen wizard's state IS a {@link ProcgenSpec} — this reducer is its only
 * writer.
 *
 * The wizard used to hold its answers in five component-local useStates and
 * mirror them into a spec with a useMemo. The wizard is mounted only while its
 * tab is active, so every tab switch reset those answers, and a publish effect
 * then wrote the DEFAULT spec over the Dungeon (UE) handoff. Holding the spec
 * in a reducer that the level-design view owns (`useLevelDesignView`) makes it
 * survive any tab round trip; the wizard falls back to a private instance of
 * the same reducer when it is rendered on its own.
 *
 * Every transition keeps `seedValue === hashSeed(seedLabel)` — the spec's rule
 * that the seed is resolved once, here, and never re-derived at a call site.
 */
import type { Dispatch } from 'react';
import { buildProcgenSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { hashSeed } from '@/lib/level-design/frandom-stream';
import { DEFAULT_SIZE } from './constants';
import {
  exportFlowReducer, exportKey, IDLE_EXPORT_FLOW, type ExportFlow, type ExportFlowAction,
} from './exportFlow';
import type { GenAlgorithm, LevelType, SizeParams, GameplayConstraints } from './types';

export interface ProcgenSpecState {
  spec: ProcgenSpec;
  /**
   * True once a wizard has been on screen. The UE handoff offers the spec only
   * from then on — a designer who never saw the preview has judged nothing.
   */
  shown: boolean;
  /**
   * The Blender export flow. It lives beside the spec, not in the wizard, for
   * the same reason the spec does: the wizard unmounts on every tab switch, and
   * an export in flight must still land its outcome.
   */
  flow: ExportFlow;
  /** A frozen copy of a spec to compare the live one against, or null. */
  pinned: ProcgenSpec | null;
  /** Undo / redo stacks of whole specs, oldest first, each capped at {@link HISTORY_CAP}. */
  past: ProcgenSpec[];
  future: ProcgenSpec[];
}

export const HISTORY_CAP = 20;

export type ProcgenSpecAction =
  | { type: 'setAlgorithm'; algorithm: GenAlgorithm }
  | { type: 'selectLevelType'; levelType: LevelType }
  | { type: 'updateSize'; key: keyof SizeParams; value: number }
  | { type: 'toggleConstraint'; key: keyof GameplayConstraints }
  | { type: 'setSeed'; seed: string }
  | { type: 'shown' }
  | { type: 'pin' }
  | { type: 'unpin' }
  | { type: 'restorePinned' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'exportFlow'; action: ExportFlowAction };

/** The reducer's state and dispatch, handed to a wizard that does not own them. */
export interface ProcgenSpecStore {
  state: ProcgenSpecState;
  dispatch: Dispatch<ProcgenSpecAction>;
}

export const DEFAULT_CONSTRAINTS: GameplayConstraints = {
  spawnPoints: true,
  lootPlacement: true,
  bossRoom: true,
  secretRooms: false,
  safeZones: false,
  // OFF by default on purpose: a spec without it reproduces the exact grid the
  // generators produced before the repair pass existed.
  ensureConnected: false,
};

export function initialProcgenSpecState(): ProcgenSpecState {
  return {
    spec: buildProcgenSpec({
      algorithm: 'bsp',
      levelType: 'dungeon',
      ...DEFAULT_SIZE.dungeon,
      seed: '',
      constraints: DEFAULT_CONSTRAINTS,
    }),
    shown: false,
    flow: IDLE_EXPORT_FLOW,
    pinned: null,
    past: [],
    future: [],
  };
}

const sameSpec = (a: ProcgenSpec, b: ProcgenSpec) => JSON.stringify(a) === JSON.stringify(b);
const capped = (stack: ProcgenSpec[]) => stack.slice(-HISTORY_CAP);

/** Make `spec` current. An edit that moves what an export would ship marks a prepared plan stale. */
function setSpec(state: ProcgenSpecState, spec: ProcgenSpec, history: Pick<ProcgenSpecState, 'past' | 'future'>): ProcgenSpecState {
  const flow = exportFlowReducer(state.flow, { type: 'specChanged', exportKey: exportKey(spec) });
  return { ...state, spec, flow, ...history };
}

/** A spec edit: records the replaced spec for undo and clears redo. A no-op edit records nothing. */
function withSpec(state: ProcgenSpecState, patch: Partial<ProcgenSpec>): ProcgenSpecState {
  const spec = { ...state.spec, ...patch };
  if (sameSpec(spec, state.spec)) return state;
  return setSpec(state, spec, { past: capped([...state.past, state.spec]), future: [] });
}

export function procgenSpecReducer(state: ProcgenSpecState, action: ProcgenSpecAction): ProcgenSpecState {
  switch (action.type) {
    case 'setAlgorithm':
      return withSpec(state, { algorithm: action.algorithm });
    case 'selectLevelType':
      // A level type brings its own default size — the wizard's long-standing rule.
      return withSpec(state, { levelType: action.levelType, ...DEFAULT_SIZE[action.levelType] });
    case 'updateSize':
      return withSpec(state, { [action.key]: action.value });
    case 'toggleConstraint':
      return withSpec(state, {
        constraints: { ...state.spec.constraints, [action.key]: !state.spec.constraints[action.key] },
      });
    case 'setSeed':
      return withSpec(state, { seedLabel: action.seed, seedValue: hashSeed(action.seed) });
    case 'exportFlow': {
      const flow = exportFlowReducer(state.flow, action.action);
      return flow === state.flow ? state : { ...state, flow };
    }
    case 'pin':
      return { ...state, pinned: { ...state.spec, constraints: { ...state.spec.constraints } } };
    case 'unpin':
      return state.pinned ? { ...state, pinned: null } : state;
    case 'restorePinned': {
      // A swap, and its own inverse: the pinned layout becomes live and the one
      // it replaces is pinned, so history is left alone and two swaps are a no-op.
      if (!state.pinned) return state;
      const next = setSpec(state, state.pinned, { past: state.past, future: state.future });
      return { ...next, pinned: state.spec };
    }
    case 'undo': {
      const prior = state.past[state.past.length - 1];
      if (!prior) return state;
      return setSpec(state, prior, { past: state.past.slice(0, -1), future: [state.spec, ...state.future].slice(0, HISTORY_CAP) });
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return setSpec(state, next, { past: capped([...state.past, state.spec]), future: rest });
    }
    case 'shown':
      return state.shown ? state : { ...state, shown: true };
  }
}
