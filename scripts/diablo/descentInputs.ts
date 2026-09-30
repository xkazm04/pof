import { combatGameMode } from '@/lib/catalog/reference/combatInputs';
import type {
  SimulateDescentInput,
  SimulateDifficultyChainInput,
} from '@/lib/catalog/reference/descentSim';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import { getDb } from '@/lib/db';

export type SharedDescentInput = Omit<SimulateDifficultyChainInput, 'difficulties'>;

export interface AssembleDescentInputOptions extends
  Omit<SimulateDescentInput, 'difficulty' | 'gameMode' | 'weapon' | 'wrappers'> {
  weaponId?: string;
}

/** Load the same locally ingested Diablo I wrappers used by the descent CLI. */
export function loadDescentWrappers(): readonly ReferenceWrapper[] {
  return listWrappers(getDb(), { sourceId: 'diablo1' });
}

/** Assemble a pure simulator input while keeping DB access outside the descent model. */
export function assembleDescentInput(
  options: AssembleDescentInputOptions,
  argv: readonly string[] = process.argv,
  wrappers: readonly ReferenceWrapper[] = loadDescentWrappers(),
): SharedDescentInput {
  const { weaponId, ...simulationOptions } = options;
  const weapon = weaponId
    ? wrappers.find((wrapper) =>
        wrapper.catalogId === 'items' && wrapper.entity.id === weaponId)
    : undefined;
  if (weaponId && !weapon) throw new Error(`no items wrapper ${weaponId}`);
  if (weapon && options.gear === 'expected') {
    throw new Error('--gear expected cannot be combined with --weapon');
  }

  return {
    ...simulationOptions,
    gameMode: combatGameMode(argv),
    weapon,
    wrappers,
  };
}
