import {
  Grid3X3, Waves, Hexagon, Mountain,
  Castle, Sword, Trophy, MapPin, Package, Gem,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_IMPROVED, ACCENT_VIOLET, STATUS_SUCCESS, ACCENT_ORANGE } from '@/lib/chart-colors';
import type { GenAlgorithm, LevelType, GameplayConstraints, SizeParams } from './types';

// ── Static Data ──

interface AlgorithmDef {
  id: GenAlgorithm;
  label: string;
  icon: typeof Grid3X3;
  color: string;
  description: string;
  bestFor: string;
}

export const ALGORITHMS: AlgorithmDef[] = [
  {
    id: 'bsp',
    label: 'BSP Tree',
    icon: Grid3X3,
    color: STATUS_IMPROVED,
    description: 'Binary Space Partitioning — recursively divides space into rooms connected by corridors.',
    bestFor: 'Dungeon rooms + corridors, roguelike layouts',
  },
  {
    id: 'wfc',
    label: 'Wave Function Collapse',
    icon: Hexagon,
    color: ACCENT_VIOLET,
    description: 'Constraint-propagation algorithm that places tiles based on adjacency rules.',
    bestFor: 'Tile-based levels, town layouts, pattern-driven generation',
  },
  {
    id: 'cellular',
    label: 'Cellular Automata',
    icon: Waves,
    color: STATUS_SUCCESS,
    description: 'Cave-like structures from iterative cell birth/death rules (similar to Conway\'s Game of Life).',
    bestFor: 'Organic caves, natural caverns, irregular shapes',
  },
  {
    id: 'perlin',
    label: 'Perlin Noise',
    icon: Mountain,
    color: ACCENT_ORANGE,
    description: 'Continuous noise function for smooth height/density maps with octave layering.',
    bestFor: 'Open world terrain, elevation maps, biome placement',
  },
];

interface LevelTypeDef {
  id: LevelType;
  label: string;
  icon: typeof Castle;
  color: string;
  description: string;
}

export const LEVEL_TYPES: LevelTypeDef[] = [
  {
    id: 'dungeon',
    label: 'Dungeon',
    icon: Castle,
    color: MODULE_COLORS.content,
    description: 'Rooms connected by corridors, doors, keys, and locked areas',
  },
  {
    id: 'openworld',
    label: 'Open World',
    icon: Mountain,
    color: STATUS_SUCCESS,
    description: 'Large terrain with biomes, POIs, roads, and seamless zones',
  },
  {
    id: 'arena',
    label: 'Arena',
    icon: Sword,
    color: MODULE_COLORS.evaluator,
    description: 'Single combat space with cover, spawn waves, and phase transitions',
  },
];

interface ConstraintDef {
  key: keyof GameplayConstraints;
  label: string;
  icon: typeof MapPin;
  description: string;
}

export const CONSTRAINTS: ConstraintDef[] = [
  { key: 'spawnPoints', label: 'Spawn Points', icon: MapPin, description: 'Player start + enemy spawn locations' },
  { key: 'lootPlacement', label: 'Loot Placement', icon: Package, description: 'Chests, item drops, loot rooms' },
  { key: 'bossRoom', label: 'Boss Room', icon: Trophy, description: 'Dedicated boss encounter area' },
  { key: 'secretRooms', label: 'Secret Rooms', icon: Gem, description: 'Hidden rooms with bonus loot' },
  { key: 'safeZones', label: 'Safe Zones', icon: Castle, description: 'Rest areas, shops, save points' },
];

export const DEFAULT_SIZE: Record<LevelType, SizeParams> = {
  dungeon: { gridWidth: 64, gridHeight: 64, roomCountMin: 8, roomCountMax: 15, corridorWidth: 3 },
  openworld: { gridWidth: 256, gridHeight: 256, roomCountMin: 20, roomCountMax: 40, corridorWidth: 5 },
  arena: { gridWidth: 32, gridHeight: 32, roomCountMin: 1, roomCountMax: 3, corridorWidth: 4 },
};
