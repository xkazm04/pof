/**
 * A Procedural Engine export ships the run on screen — its data AND the config
 * that produced it — through the one Blender dispatcher.
 *
 * Before: the store kept bare results and exported against the LIVE config, so
 * Generate at size 65 → bump Size to 257 → Export wrote "extent 256 m" over a
 * 64 m mesh, a seed edit shipped seed-42 data with nothing naming seed 42, the
 * dungeon export hand-typed cell size 2 / wall height 3 (a second copy of the
 * level wizard's convention) and dropped its seed header, one export state was
 * shared by all three generators, and the private raw fetch skipped Script
 * History.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProceduralStore } from '@/components/modules/visual-gen/procedural-engine/useProceduralStore';
import {
  GENERATOR_SPECS,
  type GeneratorType,
} from '@/components/modules/visual-gen/procedural-engine/generatorSpecs';
import { selectExportFeedback } from '@/components/modules/visual-gen/procedural-engine/useProceduralStore';
import { GENERATOR_OPTIONS } from '@/components/modules/visual-gen/procedural-engine/ProceduralEngineView/constants';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';
import {
  EXPORT_CELL_SIZE,
  EXPORT_WALL_HEIGHT,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/exportPlan';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { DEFAULT_VEGETATION_CONFIG } from '@/lib/visual-gen/generators/vegetation';

const realFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function postedCode(callIndex = 0): string {
  const call = fetchMock.mock.calls[callIndex];
  return (JSON.parse(String((call[1] as RequestInit).body)) as { code: string }).code;
}

function pyNumber(script: string, name: string): number {
  const m = new RegExp(`^${name}\\s*=\\s*(-?[\\d.eE+-]+)\\s*$`, 'm').exec(script);
  if (!m) throw new Error(`no assignment "${name}" in emitted script`);
  return Number(m[1]);
}

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ success: true, data: { output: 'Created ok' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  useBlenderStore.setState({ scripts: [] });
  useProceduralStore.setState({
    activeGenerator: 'terrain',
    terrainConfig: { ...DEFAULT_TERRAIN_CONFIG, size: 65, seed: 42 },
    dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG, seed: 42 },
    vegetationConfig: { ...DEFAULT_VEGETATION_CONFIG },
    terrainHeightmap: null,
    dungeonResult: null,
    vegetationPoints: null,
    isGenerating: false,
    exportState: { isExporting: false, exportResult: null, exportError: null },
    runs: { terrain: null, dungeon: null, vegetation: null },
    exports: { terrain: null, dungeon: null, vegetation: null },
  });
});

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('export ships the run that is on screen', () => {
  it('a size edit after Generate does not change the exported mesh or its header', async () => {
    const s = useProceduralStore.getState();
    await s.generate('terrain');
    s.setTerrainConfig({ size: 257 });
    await useProceduralStore.getState().exportToBlender('terrain');

    const code = postedCode();
    expect(code).toContain('rows, cols = 65, 65');
    expect(code).toMatch(/# Terrain basis:.*extent 64 m/);
    expect(code).not.toContain('extent 256 m');
  });

  it('a seed edit after Generate: the script names the run\'s seed and size, not the live seed', async () => {
    const s = useProceduralStore.getState();
    await s.generate('terrain');
    s.setTerrainConfig({ seed: 7 });
    await useProceduralStore.getState().exportToBlender('terrain');

    const code = postedCode();
    const provenance = code.split('\n').find((l) => /^#.*seed 42/.test(l));
    expect(provenance).toBeDefined();
    expect(provenance).toMatch(/size 65/);
    expect(code).not.toMatch(/seed 7\b/);
  });

  it('dungeon export carries the seed/algorithm header and the ONE world convention', async () => {
    await useProceduralStore.getState().generate('dungeon');
    await useProceduralStore.getState().exportToBlender('dungeon');

    const code = postedCode();
    expect(code.startsWith('# ─')).toBe(true);
    const header = code.split('\n').slice(0, 8).join('\n');
    expect(header).toContain('# Algorithm: bsp');
    expect(header).toMatch(/^# Seed:.*42$/m);
    expect(pyNumber(code, 'cell_size')).toBe(EXPORT_CELL_SIZE);
    expect(pyNumber(code, 'wall_height')).toBe(EXPORT_WALL_HEIGHT);
  });

  it('dispatches through executeViaMCP, so the export lands in Script History', async () => {
    await useProceduralStore.getState().generate('vegetation');
    await useProceduralStore.getState().exportToBlender('vegetation');

    const scripts = useBlenderStore.getState().scripts;
    expect(scripts).toHaveLength(1);
    expect(scripts[0].scriptName).toBe('Procedural export: vegetation');
    expect(scripts[0].status).toBe('completed');
  });
});

describe('export feedback belongs to its generator', () => {
  it('a terrain export does not show under the Dungeon tab', async () => {
    await useProceduralStore.getState().generate('terrain');
    await useProceduralStore.getState().exportToBlender('terrain');
    useProceduralStore.getState().setActiveGenerator('dungeon');

    const state = useProceduralStore.getState();
    expect(selectExportFeedback(state, 'dungeon')).toBeNull();
    expect(selectExportFeedback(state, 'terrain')).toMatchObject({
      isExporting: false,
      exportResult: 'Created ok',
      exportError: null,
    });
  });
});

describe('one generator table', () => {
  it('the selector options are derived from GENERATOR_SPECS', () => {
    expect(Object.keys(GENERATOR_SPECS)).toEqual(GENERATOR_OPTIONS.map((o) => o.id));
  });

  it.each(Object.keys(GENERATOR_SPECS) as GeneratorType[])(
    '%s: its defaults generate and export to a non-empty script',
    (type) => {
      const spec = GENERATOR_SPECS[type] as unknown as {
        defaults: unknown;
        generate: (c: unknown) => unknown;
        toExportScript: (d: unknown, c: unknown) => { ok: boolean; data?: string };
      };
      const out = spec.toExportScript(spec.generate(spec.defaults), spec.defaults);
      expect(out.ok).toBe(true);
      expect(out.data?.trim().length ?? 0).toBeGreaterThan(0);
    },
  );
});
