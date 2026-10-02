/**
 * The Procedural Engine's ONE generator table.
 *
 * Every generator is a row: its label, defaults, how it generates, how it
 * summarises a result, and how a run (data + the config that produced it)
 * becomes a Blender script. The view, the store and the export path read this
 * table instead of branching on the generator type, so a fourth generator is
 * one row, not seven branch edits plus a copied export action.
 *
 * Pure: no React, no store, no I/O.
 */
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { logger } from '@/lib/logger';
import {
  DEFAULT_TERRAIN_CONFIG,
  generateDiamondSquare,
  resolveTerrainBasis,
  type TerrainConfig,
} from '@/lib/visual-gen/generators/terrain';
import {
  DEFAULT_DUNGEON_CONFIG,
  generateDungeon,
  type DungeonConfig,
  type DungeonResult,
} from '@/lib/visual-gen/generators/dungeon';
import {
  DEFAULT_VEGETATION_CONFIG,
  generateVegetation,
  type ScatterPoint,
  type VegetationConfig,
} from '@/lib/visual-gen/generators/vegetation';
import { terrainToMeshScript } from '@/lib/blender-mcp/scripts/terrain-to-mesh';
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { scatterVegetationScript } from '@/lib/blender-mcp/scripts/scatter-vegetation';
// The dungeon's metre convention has one authority: the level wizard's export plan.
import {
  EXPORT_CELL_SIZE,
  EXPORT_WALL_HEIGHT,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/exportPlan';

export type GeneratorType = 'terrain' | 'dungeon' | 'vegetation';

export interface GeneratorConfigs {
  terrain: TerrainConfig;
  dungeon: DungeonConfig;
  vegetation: VegetationConfig;
}

export interface GeneratorData {
  terrain: number[][];
  dungeon: DungeonResult;
  vegetation: ScatterPoint[];
}

export interface GeneratorSpec<K extends GeneratorType> {
  label: string;
  description: string;
  /** Shown in the preview before the first Generate. */
  emptyHint: string;
  defaults: GeneratorConfigs[K];
  generate: (config: GeneratorConfigs[K]) => GeneratorData[K];
  /** One line under the preview. */
  summarize: (data: GeneratorData[K]) => string;
  /** The run's size in words, for the provenance line and the stale notice. */
  describeSize: (config: GeneratorConfigs[K]) => string;
  toExportScript: (data: GeneratorData[K], config: GeneratorConfigs[K]) => Result<string, string>;
  /** The Script History row name. */
  exportName: string;
}

/**
 * One `#` line naming the run a script was built from. Inserted after any
 * leading comment block (the dungeon's own provenance header stays first).
 */
export function withProvenance(script: string, type: GeneratorType, seed: number, size: string): string {
  const line = `# PoF procedural run: ${type}, seed ${seed}, size ${size} (the previewed run's config)`;
  const lines = script.split('\n');
  let at = 0;
  while (at < lines.length && lines[at].startsWith('#')) at++;
  lines.splice(at, 0, line);
  return lines.join('\n');
}

const terrain: GeneratorSpec<'terrain'> = {
  label: 'Terrain Heightmap',
  description: 'Diamond-Square algorithm for realistic terrain elevation',
  emptyHint: 'Click Generate to create a terrain heightmap',
  defaults: DEFAULT_TERRAIN_CONFIG,
  generate: (config) => generateDiamondSquare(config),
  summarize: (data) => `${data.length}x${data[0]?.length ?? 0} heightmap generated`,
  describeSize: (config) => String(config.size),
  exportName: 'Procedural export: terrain',
  toExportScript: (data, config) => {
    // The vertical scale has ONE authority: the config's declared `verticalRangeM`.
    const basis = resolveTerrainBasis(config);
    if (!basis.ok) return err(basis.error);
    if (!basis.data.declared) {
      logger.warn(
        '[procedural-engine] Terrain config carries no declared basis; exporting with the ' +
          'legacy fallback — the result is not gradeable for slope.',
      );
    }
    const script = terrainToMeshScript({ heightmap: data, basis: basis.data });
    return ok(withProvenance(script, 'terrain', config.seed, terrain.describeSize(config)));
  },
};

const dungeon: GeneratorSpec<'dungeon'> = {
  label: 'Dungeon Layout',
  description: 'BSP tree dungeon with rooms, corridors, and walls',
  emptyHint: 'Click Generate to create a dungeon layout',
  defaults: DEFAULT_DUNGEON_CONFIG,
  generate: (config) => generateDungeon(config),
  summarize: (data) => `${data.rooms.length} rooms generated`,
  describeSize: (config) => `${config.width}x${config.height}`,
  exportName: 'Procedural export: dungeon',
  toExportScript: (data, config) => {
    const script = dungeonToGeometryScript({
      grid: data.grid,
      cellSize: EXPORT_CELL_SIZE,
      wallHeight: EXPORT_WALL_HEIGHT,
      meta: {
        algorithm: 'bsp',
        requestedWidth: config.width,
        requestedHeight: config.height,
        scale: 1,
        seedLabel: String(config.seed),
        seedValue: config.seed,
      },
    });
    return ok(withProvenance(script, 'dungeon', config.seed, dungeon.describeSize(config)));
  },
};

const vegetation: GeneratorSpec<'vegetation'> = {
  label: 'Vegetation Scatter',
  description: 'Poisson disk sampling for natural vegetation placement',
  emptyHint: 'Click Generate to scatter vegetation points',
  defaults: DEFAULT_VEGETATION_CONFIG,
  generate: (config) => generateVegetation(config),
  summarize: (data) => `${data.length} scatter points generated`,
  describeSize: (config) => `${config.width}x${config.height}`,
  exportName: 'Procedural export: vegetation',
  toExportScript: (data, config) => {
    const speciesNames: Record<string, string> = {};
    for (const sp of config.species) speciesNames[sp.id] = sp.name;
    const script = scatterVegetationScript({ points: data, speciesNames });
    return ok(withProvenance(script, 'vegetation', config.seed, vegetation.describeSize(config)));
  },
};

export const GENERATOR_SPECS: { [K in GeneratorType]: GeneratorSpec<K> } = {
  terrain,
  dungeon,
  vegetation,
};

export const GENERATOR_TYPES = Object.keys(GENERATOR_SPECS) as GeneratorType[];

/** The spec for `type`, typed for a caller holding the correlated config/data. */
export function specOf<K extends GeneratorType>(type: K): GeneratorSpec<K> {
  return GENERATOR_SPECS[type];
}

/** Config fields whose value differs between a run's config and the live one. */
export function diffConfigFields(runConfig: object, liveConfig: object): string[] {
  const a = runConfig as Record<string, unknown>;
  const b = liveConfig as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
