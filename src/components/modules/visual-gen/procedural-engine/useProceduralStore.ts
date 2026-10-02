import { create } from 'zustand';
import type { TerrainConfig } from '@/lib/visual-gen/generators/terrain';
import type { DungeonConfig, DungeonResult } from '@/lib/visual-gen/generators/dungeon';
import type { VegetationConfig, ScatterPoint } from '@/lib/visual-gen/generators/vegetation';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { DEFAULT_VEGETATION_CONFIG } from '@/lib/visual-gen/generators/vegetation';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';
import { logger } from '@/lib/logger';
import {
  diffConfigFields,
  specOf,
  type GeneratorConfigs,
  type GeneratorData,
  type GeneratorType,
} from './generatorSpecs';

export type { GeneratorType } from './generatorSpecs';

export interface ExportState {
  isExporting: boolean;
  exportResult: string | null;
  exportError: string | null;
}

/** A generated result bound to the config snapshot that produced it. */
export interface GeneratorRun<K extends GeneratorType = GeneratorType> {
  config: GeneratorConfigs[K];
  data: GeneratorData[K];
  generatedAt: number;
}

type RunMap = { [K in GeneratorType]: GeneratorRun<K> | null };
type ExportMap = Record<GeneratorType, ExportState | null>;

export interface ProceduralState {
  activeGenerator: GeneratorType;
  terrainConfig: TerrainConfig;
  dungeonConfig: DungeonConfig;
  vegetationConfig: VegetationConfig;

  // Preview data (the current run's data; also settable directly)
  terrainHeightmap: number[][] | null;
  dungeonResult: DungeonResult | null;
  vegetationPoints: ScatterPoint[] | null;

  /** Each generator's last run with the config it was generated from. */
  runs: RunMap;
  /** Export feedback per generator — a terrain export never shows under Dungeon. */
  exports: ExportMap;

  isGenerating: boolean;

  /** Mirror of the LAST export of any generator (kept for existing readers). */
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

  /** Generate with the CURRENT config and bind the result to a snapshot of it. */
  generate: (type: GeneratorType) => Promise<void>;
  /** Export the run on screen: its data with ITS config, via executeViaMCP. */
  exportToBlender: (type: GeneratorType) => Promise<void>;
  exportTerrainToBlender: () => Promise<void>;
  exportDungeonToBlender: () => Promise<void>;
  exportVegetationToBlender: () => Promise<void>;
}

const CONFIG_KEY = {
  terrain: 'terrainConfig',
  dungeon: 'dungeonConfig',
  vegetation: 'vegetationConfig',
} as const;

const DATA_KEY = {
  terrain: 'terrainHeightmap',
  dungeon: 'dungeonResult',
  vegetation: 'vegetationPoints',
} as const;

const NO_RUNS: RunMap = { terrain: null, dungeon: null, vegetation: null };
const NO_EXPORTS: ExportMap = { terrain: null, dungeon: null, vegetation: null };

const INITIAL_EXPORT_STATE: ExportState = {
  isExporting: false,
  exportResult: null,
  exportError: null,
};

export type RunView<K extends GeneratorType = GeneratorType> =
  | { status: 'none'; staleBecause: string[]; run: null }
  | { status: 'fresh' | 'stale'; staleBecause: string[]; run: GeneratorRun<K> };

/**
 * The run `type` exports: the bound run when the preview data IS its data;
 * otherwise (data set directly, no run) that data under the live config.
 */
function exportableRun<K extends GeneratorType>(s: ProceduralState, type: K): GeneratorRun<K> | null {
  const data = s[DATA_KEY[type]] as GeneratorData[K] | null;
  if (!data) return null;
  const run = s.runs[type] as GeneratorRun<K> | null;
  if (run && run.data === data) return run;
  return { config: s[CONFIG_KEY[type]] as GeneratorConfigs[K], data, generatedAt: 0 };
}

/** Fresh/stale by field comparison against the live config — not a dirty flag. */
export function selectRun<K extends GeneratorType>(s: ProceduralState, type: K): RunView<K> {
  const run = exportableRun(s, type);
  if (!run) return { status: 'none', staleBecause: [], run: null };
  const staleBecause = diffConfigFields(run.config, s[CONFIG_KEY[type]]);
  return { status: staleBecause.length > 0 ? 'stale' : 'fresh', staleBecause, run };
}

export function selectExportFeedback(s: ProceduralState, type: GeneratorType): ExportState | null {
  return s.exports[type];
}

/** Let the "Generating..." state paint before the generator blocks the thread. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export const useProceduralStore = create<ProceduralState>((set, get) => {
  const setExport = (type: GeneratorType, state: ExportState) =>
    set((s) => ({ exports: { ...s.exports, [type]: state }, exportState: state }));

  return {
    activeGenerator: 'terrain',
    terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
    dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
    vegetationConfig: { ...DEFAULT_VEGETATION_CONFIG },

    terrainHeightmap: null,
    dungeonResult: null,
    vegetationPoints: null,
    runs: NO_RUNS,
    exports: NO_EXPORTS,
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
      runs: NO_RUNS,
    }),

    generate: async (type) => {
      set({ isGenerating: true });
      await nextFrame();
      try {
        const spec = specOf(type);
        const config = structuredClone(get()[CONFIG_KEY[type]]) as GeneratorConfigs[typeof type];
        const data = (spec.generate as (c: typeof config) => GeneratorData[typeof type])(config);
        const run = { config, data, generatedAt: Date.now() };
        set((s) => ({ runs: { ...s.runs, [type]: run }, [DATA_KEY[type]]: data }));
      } finally {
        set({ isGenerating: false });
      }
    },

    exportToBlender: async (type) => {
      const run = exportableRun(get(), type);
      if (!run) return;
      const spec = specOf(type);
      const script = (spec.toExportScript as (d: unknown, c: unknown) => ReturnType<typeof spec.toExportScript>)(
        run.data,
        run.config,
      );
      if (!script.ok) {
        logger.warn(`[procedural-engine] ${type} export refused:`, script.error);
        setExport(type, { isExporting: false, exportResult: null, exportError: script.error });
        return;
      }

      setExport(type, { isExporting: true, exportResult: null, exportError: null });
      const res = await executeViaMCP(spec.exportName, script.data);
      if (!res.ok) logger.warn(`[procedural-engine] ${type} export failed:`, res.error);
      setExport(type, {
        isExporting: false,
        exportResult: res.ok ? res.data.output : null,
        exportError: res.ok ? null : res.error,
      });
    },

    exportTerrainToBlender: () => get().exportToBlender('terrain'),
    exportDungeonToBlender: () => get().exportToBlender('dungeon'),
    exportVegetationToBlender: () => get().exportToBlender('vegetation'),
  };
});
