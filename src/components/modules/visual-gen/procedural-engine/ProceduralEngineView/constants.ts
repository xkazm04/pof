import type { GeneratorType } from '../useProceduralStore';
import { GENERATOR_SPECS, GENERATOR_TYPES } from '../generatorSpecs';
import type { CellType } from '@/lib/visual-gen/generators/dungeon';

/** Derived from the generator table - a new generator is a GENERATOR_SPECS row, not a list edit here. */
export const GENERATOR_OPTIONS: { id: GeneratorType; label: string; description: string }[] =
  GENERATOR_TYPES.map((id) => ({
    id,
    label: GENERATOR_SPECS[id].label,
    description: GENERATOR_SPECS[id].description,
  }));

export const CELL_COLORS: Record<CellType, string> = {
  empty: '#111827',
  floor: '#6b7280',
  wall: '#374151',
  door: '#f59e0b',
  corridor: '#4b5563',
};
