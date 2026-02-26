import { create } from 'zustand';
import type { TerrainConfig } from '@/lib/visual-gen/generators/terrain';
import type { DungeonConfig, DungeonResult } from '@/lib/visual-gen/generators/dungeon';
import type { VegetationConfig, ScatterPoint } from '@/lib/visual-gen/generators/vegetation';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { DEFAULT_VEGETATION_CONFIG } from '@/lib/visual-gen/generators/vegetation';

export type GeneratorType = 'terrain' | 'dungeon' | 'vegetation';

interface ProceduralState {
  activeGenerator: GeneratorType;
  terrainConfig: TerrainConfig;
  dungeonConfig: DungeonConfig;
  vegetationConfig: VegetationConfig;

  // Preview data
  terrainHeightmap: number[][] | null;
  dungeonResult: DungeonResult | null;
  vegetationPoints: ScatterPoint[] | null;

  isGenerating: boolean;

  setActiveGenerator: (type: GeneratorType) => void;
  setTerrainConfig: (config: Partial<TerrainConfig>) => void;
  setDungeonConfig: (config: Partial<DungeonConfig>) => void;
  setVegetationConfig: (config: Partial<VegetationConfig>) => void;
  setTerrainHeightmap: (heightmap: number[][] | null) => void;
  setDungeonResult: (result: DungeonResult | null) => void;
  setVegetationPoints: (points: ScatterPoint[] | null) => void;
  setGenerating: (generating: boolean) => void;
  clearResults: () => void;
}

export const useProceduralStore = create<ProceduralState>((set) => ({
  activeGenerator: 'terrain',
  terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
  dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
  vegetationConfig: { ...DEFAULT_VEGETATION_CONFIG },

  terrainHeightmap: null,
  dungeonResult: null,
  vegetationPoints: null,
  isGenerating: false,

  setActiveGenerator: (type) => set({ activeGenerator: type }),

  setTerrainConfig: (config) =>
    set((s) => ({ terrainConfig: { ...s.terrainConfig, ...config } })),

  setDungeonConfig: (config) =>
    set((s) => ({ dungeonConfig: { ...s.dungeonConfig, ...config } })),

  setVegetationConfig: (config) =>
    set((s) => ({ vegetationConfig: { ...s.vegetationConfig, ...config } })),

  setTerrainHeightmap: (heightmap) => set({ terrainHeightmap: heightmap }),
  setDungeonResult: (result) => set({ dungeonResult: result }),
  setVegetationPoints: (points) => set({ vegetationPoints: points }),
  setGenerating: (generating) => set({ isGenerating: generating }),

  clearResults: () => set({
    terrainHeightmap: null,
    dungeonResult: null,
    vegetationPoints: null,
  }),
}));
