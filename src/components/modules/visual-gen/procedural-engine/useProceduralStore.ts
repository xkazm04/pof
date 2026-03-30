import { create } from 'zustand';
import type { TerrainConfig } from '@/lib/visual-gen/generators/terrain';
import type { DungeonConfig, DungeonResult } from '@/lib/visual-gen/generators/dungeon';
import type { VegetationConfig, ScatterPoint } from '@/lib/visual-gen/generators/vegetation';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { DEFAULT_VEGETATION_CONFIG } from '@/lib/visual-gen/generators/vegetation';
import { tryApiFetch } from '@/lib/api-utils';
import { terrainToMeshScript } from '@/lib/blender-mcp/scripts/terrain-to-mesh';
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { scatterVegetationScript } from '@/lib/blender-mcp/scripts/scatter-vegetation';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';

export type GeneratorType = 'terrain' | 'dungeon' | 'vegetation';

interface ExportState {
  isExporting: boolean;
  exportResult: string | null;
  exportError: string | null;
}

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

  // Blender export state
  exportState: ExportState;

  setActiveGenerator: (type: GeneratorType) => void;
  setTerrainConfig: (config: Partial<TerrainConfig>) => void;
  setDungeonConfig: (config: Partial<DungeonConfig>) => void;
  setVegetationConfig: (config: Partial<VegetationConfig>) => void;
  setTerrainHeightmap: (heightmap: number[][] | null) => void;
  setDungeonResult: (result: DungeonResult | null) => void;
  setVegetationPoints: (points: ScatterPoint[] | null) => void;
  setGenerating: (generating: boolean) => void;
  clearResults: () => void;

  // Blender export actions
  exportTerrainToBlender: () => Promise<void>;
  exportDungeonToBlender: () => Promise<void>;
  exportVegetationToBlender: () => Promise<void>;
}

const INITIAL_EXPORT_STATE: ExportState = {
  isExporting: false,
  exportResult: null,
  exportError: null,
};

async function executeBlenderScript(code: string): Promise<{ result?: string; error?: string }> {
  const res = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (res.ok) {
    return { result: res.data.output };
  }
  return { error: res.error };
}

export const useProceduralStore = create<ProceduralState>((set, get) => ({
  activeGenerator: 'terrain',
  terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
  dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
  vegetationConfig: { ...DEFAULT_VEGETATION_CONFIG },

  terrainHeightmap: null,
  dungeonResult: null,
  vegetationPoints: null,
  isGenerating: false,

  exportState: { ...INITIAL_EXPORT_STATE },

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

  exportTerrainToBlender: async () => {
    const { terrainHeightmap, terrainConfig } = get();
    if (!terrainHeightmap) return;

    set({ exportState: { isExporting: true, exportResult: null, exportError: null } });

    const code = terrainToMeshScript({
      heightmap: terrainHeightmap,
      gridSize: terrainConfig.size,
      heightScale: 10,
    });

    const { result, error } = await executeBlenderScript(code);
    if (error) {
      logger.warn('[procedural-engine] Terrain export failed:', error);
    }
    set({
      exportState: {
        isExporting: false,
        exportResult: result ?? null,
        exportError: error ?? null,
      },
    });
  },

  exportDungeonToBlender: async () => {
    const { dungeonResult } = get();
    if (!dungeonResult) return;

    set({ exportState: { isExporting: true, exportResult: null, exportError: null } });

    const code = dungeonToGeometryScript({
      grid: dungeonResult.grid,
      cellSize: 2,
      wallHeight: 3,
    });

    const { result, error } = await executeBlenderScript(code);
    if (error) {
      logger.warn('[procedural-engine] Dungeon export failed:', error);
    }
    set({
      exportState: {
        isExporting: false,
        exportResult: result ?? null,
        exportError: error ?? null,
      },
    });
  },

  exportVegetationToBlender: async () => {
    const { vegetationPoints, vegetationConfig } = get();
    if (!vegetationPoints) return;

    set({ exportState: { isExporting: true, exportResult: null, exportError: null } });

    const speciesNames: Record<string, string> = {};
    for (const sp of vegetationConfig.species) {
      speciesNames[sp.id] = sp.name;
    }

    const code = scatterVegetationScript({
      points: vegetationPoints,
      speciesNames,
    });

    const { result, error } = await executeBlenderScript(code);
    if (error) {
      logger.warn('[procedural-engine] Vegetation export failed:', error);
    }
    set({
      exportState: {
        isExporting: false,
        exportResult: result ?? null,
        exportError: error ?? null,
      },
    });
  },
}));
