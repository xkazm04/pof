/**
 * A heightfield carries TWO scales, and neither is recoverable from the numbers.
 *
 * `TerrainConfig` used to declare a sample COUNT (`size`) and a bare "height value"
 * range, so the only horizontal quantity in the pipeline was
 * `spacing = grid_size / max(rows, cols)` in the Blender script — a division of a grid
 * size by the sample count it was handed under a different name, which evaluates to 1
 * by accident. Unity is the most dangerous possible value: it makes the missing
 * division invisible, so raising the grid to 257 silently doubles the world's extent
 * while halving every slope, and nothing announces it.
 *
 * The decisive case below is the one the old shape CANNOT express: two fields with the
 * SAME sample count and DIFFERENT declared cell sizes must land at different
 * world-space spacing. Under the old derivation both come out at 1.
 *
 * The parity cases pin the other half — the documented defaults must reproduce the
 * legacy world coordinates exactly, so declaring a basis is provably not a behaviour
 * change for anything that exists today.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TERRAIN_CONFIG,
  LEGACY_TERRAIN_BASIS,
  TERRAIN_UNIT,
  resolveTerrainBasis,
  type TerrainConfig,
} from '@/lib/visual-gen/generators/terrain';
import { terrainToMeshScript } from '@/lib/blender-mcp/scripts/terrain-to-mesh';

const HEIGHTMAP: number[][] = [
  [0, 0.25, 0.5],
  [0.75, 1, 0.5],
  [0.25, 0, 0.125],
];

/** Pull a `name = <number>` assignment out of the emitted Python. */
function pyNumber(script: string, name: string): number {
  const m = new RegExp(`^${name}\\s*=\\s*(-?[\\d.eE+-]+)\\s*$`, 'm').exec(script);
  if (!m) throw new Error(`no assignment "${name}" in emitted script:\n${script}`);
  return Number(m[1]);
}

/** The vertex tuple the emitted script will build, computed the way the script does. */
function verticesOf(script: string, heightmap: number[][]): [number, number, number][] {
  const spacing = pyNumber(script, 'spacing_m');
  const multiplier = pyNumber(script, 'metres_per_sample');
  const out: [number, number, number][] = [];
  for (let r = 0; r < heightmap.length; r++) {
    for (let c = 0; c < heightmap[r].length; c++) {
      out.push([c * spacing, r * spacing, heightmap[r][c] * multiplier]);
    }
  }
  return out;
}

/**
 * The world coordinates the PREVIOUS implementation produced:
 * `spacing = grid_size / max(rows, cols)` with `grid_size` fed the sample count, and
 * a hand-typed `heightScale: 10` supplied by the store.
 */
function legacyVertices(heightmap: number[][], gridSize: number, heightScale: number) {
  const rows = heightmap.length;
  const cols = heightmap[0]?.length ?? 0;
  const spacing = gridSize / Math.max(rows, cols);
  const out: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push([c * spacing, r * spacing, heightmap[r][c] * heightScale]);
    }
  }
  return out;
}

function basisOf(config: TerrainConfig) {
  const res = resolveTerrainBasis(config);
  if (!res.ok) throw new Error(`expected a resolvable basis, got: ${res.error}`);
  return res.data;
}

describe('TerrainConfig declares its basis', () => {
  it('names the unit every spatial quantity is written in', () => {
    expect(TERRAIN_UNIT).toBe('m');
  });

  it('ships a cell size and a vertical range on the default config', () => {
    expect(DEFAULT_TERRAIN_CONFIG.cellSizeM).toBe(LEGACY_TERRAIN_BASIS.cellSizeM);
    expect(DEFAULT_TERRAIN_CONFIG.verticalRangeM).toBe(LEGACY_TERRAIN_BASIS.verticalRangeM);
  });

  it('resolves the derived quantities the acceptance checks will read', () => {
    const basis = basisOf({ ...DEFAULT_TERRAIN_CONFIG, size: 129, cellSizeM: 2, verticalRangeM: 40 });
    expect(basis.unit).toBe('m');
    expect(basis.declared).toBe(true);
    // 128 cells across at 2 m each
    expect(basis.extentM).toBe(256);
    // full [0,1] sample span covers 40 m
    expect(basis.metresPerSampleM).toBe(40);
    // 16-bit export → smallest expressible elevation step
    expect(basis.quantizationStepM).toBeCloseTo(40 / 65535, 12);
  });

  it('folds a non-unit sample span into metres per sample', () => {
    const basis = basisOf({
      ...DEFAULT_TERRAIN_CONFIG,
      minHeight: 100,
      maxHeight: 200,
      verticalRangeM: 50,
    });
    // 100 units of sample span cover 50 m
    expect(basis.metresPerSampleM).toBeCloseTo(0.5, 12);
  });

  it('refuses a non-positive or unusable basis instead of inventing one', () => {
    expect(resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 0 }).ok).toBe(false);
    expect(resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: -3 }).ok).toBe(false);
    expect(resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, verticalRangeM: Number.NaN }).ok).toBe(false);
    expect(
      resolveTerrainBasis({ ...DEFAULT_TERRAIN_CONFIG, minHeight: 1, maxHeight: 1 }).ok,
    ).toBe(false);
  });

  it('marks a legacy config that carries no basis as undeclared', () => {
    const legacy: TerrainConfig = {
      size: 129, roughness: 0.5, minHeight: 0, maxHeight: 1, seed: 42,
    };
    const basis = basisOf(legacy);
    expect(basis.declared).toBe(false);
    expect(basis.cellSizeM).toBe(LEGACY_TERRAIN_BASIS.cellSizeM);
    expect(basis.verticalRangeM).toBe(LEGACY_TERRAIN_BASIS.verticalRangeM);
  });
});

describe('terrainToMeshScript derives spacing from the declared cell size', () => {
  it('DECISIVE: same sample count, different cell size → different world spacing', () => {
    const fine = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 1 }),
    });
    const coarse = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 4 }),
    });

    expect(pyNumber(fine, 'spacing_m')).toBe(1);
    expect(pyNumber(coarse, 'spacing_m')).toBe(4);

    // The old derivation could not tell these apart: both grids are 3x3.
    const legacySpacing = 3 / 3;
    expect(pyNumber(coarse, 'spacing_m')).not.toBe(legacySpacing);
    expect(verticesOf(coarse, HEIGHTMAP)).not.toEqual(verticesOf(fine, HEIGHTMAP));
  });

  it('never divides by the sample count', () => {
    const script = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 4 }),
    });
    expect(script).not.toMatch(/spacing\w*\s*=\s*grid_size\s*\/\s*max\(/);
  });

  it('applies the declared vertical, not a multiplier of its own', () => {
    const script = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG, verticalRangeM: 250 }),
    });
    expect(pyNumber(script, 'metres_per_sample')).toBe(250);
  });

  it('PARITY: the documented defaults reproduce the legacy world coordinates exactly', () => {
    const script = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG }),
    });
    // Legacy: gridSize = terrainConfig.size fed to `grid_size / max(rows, cols)`,
    // heightScale hand-typed as 10 in the store.
    const before = legacyVertices(HEIGHTMAP, HEIGHTMAP.length, 10);
    expect(verticesOf(script, HEIGHTMAP)).toEqual(before);
  });

  it('PARITY: a persisted config with no basis also reproduces the legacy coordinates', () => {
    const legacy: TerrainConfig = {
      size: 129, roughness: 0.5, minHeight: 0, maxHeight: 1, seed: 42,
    };
    const script = terrainToMeshScript({ heightmap: HEIGHTMAP, basis: basisOf(legacy) });
    expect(verticesOf(script, HEIGHTMAP)).toEqual(legacyVertices(HEIGHTMAP, HEIGHTMAP.length, 10));
  });

  it('states the basis in the emitted script so the mesh is not anonymous', () => {
    const script = terrainToMeshScript({
      heightmap: HEIGHTMAP,
      basis: basisOf({ ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 2, verticalRangeM: 40 }),
    });
    expect(script).toContain('metres');
  });
});

describe('one authority for the vertical scale', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { output: 'ok' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('the store exports with the config\'s declared vertical, not a hand-typed constant', async () => {
    const { useProceduralStore } = await import(
      '@/components/modules/visual-gen/procedural-engine/useProceduralStore'
    );
    useProceduralStore.setState({
      terrainHeightmap: HEIGHTMAP,
      terrainConfig: { ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 5, verticalRangeM: 123 },
    });

    await useProceduralStore.getState().exportTerrainToBlender();

    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(String((call[1] as RequestInit).body)) as { code: string };
    expect(pyNumber(body.code, 'metres_per_sample')).toBe(123);
    expect(pyNumber(body.code, 'spacing_m')).toBe(5);
  });

  it('refuses to export a config whose basis cannot be resolved', async () => {
    const { useProceduralStore } = await import(
      '@/components/modules/visual-gen/procedural-engine/useProceduralStore'
    );
    useProceduralStore.setState({
      terrainHeightmap: HEIGHTMAP,
      terrainConfig: { ...DEFAULT_TERRAIN_CONFIG, cellSizeM: 0 },
      exportState: { isExporting: false, exportResult: null, exportError: null },
    });

    await useProceduralStore.getState().exportTerrainToBlender();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(useProceduralStore.getState().exportState.exportError).toBeTruthy();
  });
});
