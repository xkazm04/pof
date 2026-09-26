/** Engine-derived monster AI specifications from the pinned DevilutionX source. */
import { D1_AI_ROUTINES_DATA } from '@/lib/catalog/reference/aiRoutinesData';

export type AiAttackKind = 'melee' | 'missile' | 'special' | 'summon' | 'heal' | 'none';

export type AiRollChance =
  | { readonly linear: { readonly perIntelligence: number; readonly base: number } }
  | { readonly expression: string };

export interface AiRoutineRoll {
  readonly when: string;
  readonly chance: AiRollChance;
  readonly onSuccess: string;
  readonly onFail: string;
  /** Structured delay used by cadence projections; absent when the routine does not delay on failure. */
  readonly pause?: { readonly base: number; readonly perIntelligence: number; readonly randomMax: number };
}

export interface AiRoutineDistance {
  readonly name: string;
  readonly tiles: string;
  readonly meaning: string;
  /** Exact boundary used by projections when the textual tile expression is not itself numeric data. */
  readonly threshold?: number;
}

export interface AiRoutineAttack {
  readonly kind: AiAttackKind;
  readonly missile: string;
  readonly condition: string;
}

export interface AiRoutineSpec {
  readonly lawId: string;
  readonly states: readonly string[];
  readonly rolls: readonly AiRoutineRoll[];
  readonly distances: readonly AiRoutineDistance[];
  readonly attacks: readonly AiRoutineAttack[];
  readonly movement: string;
  readonly special: string;
  readonly hellfire: boolean;
}

export const D1_AI_ROUTINES = D1_AI_ROUTINES_DATA satisfies Record<string, AiRoutineSpec>;

export type D1AiRoutineId = keyof typeof D1_AI_ROUTINES;

export function isD1AiRoutineId(ai: string): ai is D1AiRoutineId {
  return Object.hasOwn(D1_AI_ROUTINES, ai);
}
