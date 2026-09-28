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
import type { GenAlgorithm, LevelType, SizeParams, GameplayConstraints } from './types';

export interface ProcgenSpecState {
  spec: ProcgenSpec;
  /**
   * True once a wizard has been on screen. The UE handoff offers the spec only
   * from then on — a designer who never saw the preview has judged nothing.
   */
  shown: boolean;
}

export type ProcgenSpecAction =
  | { type: 'setAlgorithm'; algorithm: GenAlgorithm }
  | { type: 'selectLevelType'; levelType: LevelType }
  | { type: 'updateSize'; key: keyof SizeParams; value: number }
  | { type: 'toggleConstraint'; key: keyof GameplayConstraints }
  | { type: 'setSeed'; seed: string }
  | { type: 'shown' };

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
  };
}

function withSpec(state: ProcgenSpecState, patch: Partial<ProcgenSpec>): ProcgenSpecState {
  return { ...state, spec: { ...state.spec, ...patch } };
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
    case 'shown':
      return state.shown ? state : { ...state, shown: true };
  }
}
