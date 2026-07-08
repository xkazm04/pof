import type { GeneratorType } from '../useProceduralStore';
import type { CellType } from '@/lib/visual-gen/generators/dungeon';

export const GENERATOR_OPTIONS: { id: GeneratorType; label: string; description: string }[] = [
  { id: 'terrain', label: 'Terrain Heightmap', description: 'Diamond-Square algorithm for realistic terrain elevation' },
  { id: 'dungeon', label: 'Dungeon Layout', description: 'BSP tree dungeon with rooms, corridors, and walls' },
  { id: 'vegetation', label: 'Vegetation Scatter', description: 'Poisson disk sampling for natural vegetation placement' },
];

export const CELL_COLORS: Record<CellType, string> = {
  empty: '#111827',
  floor: '#6b7280',
  wall: '#374151',
  door: '#f59e0b',
  corridor: '#4b5563',
};
