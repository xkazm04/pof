// ── Types ──

export type GenAlgorithm = 'bsp' | 'wfc' | 'cellular' | 'perlin';
export type LevelType = 'dungeon' | 'openworld' | 'arena';

export interface SizeParams {
  gridWidth: number;
  gridHeight: number;
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
}

export interface GameplayConstraints {
  spawnPoints: boolean;
  lootPlacement: boolean;
  bossRoom: boolean;
  secretRooms: boolean;
  safeZones: boolean;
}

export interface ProceduralLevelConfig {
  algorithm: GenAlgorithm;
  levelType: LevelType;
  size: SizeParams;
  constraints: GameplayConstraints;
  seed: string;
}
