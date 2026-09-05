/**
 * The grid-as-data path: round-trip fidelity, the honesty of the `grid-replay`
 * parity claim, and the pin between the exported JSON and the UE replay script
 * that consumes it.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract` (a stored plan is the authority; the contract
 * states its limits) and `declare-what-each-engine-ignores` (the artifact
 * carries the consumed AND the ignored spec fields as data).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  exportProcgenGrid,
  importProcgenGrid,
  procgenGridExportFilename,
  PROCGEN_GRID_EXPORT_FIELDS,
  PROCGEN_GRID_EXPORT_VERSION,
  CELL_GLYPHS,
} from '@/lib/level-design/procgen-grid-export';
import {
  buildProcgenSpec,
  previewConfigFromSpec,
  layoutAgreement,
  PROCGEN_ENGINES,
  type ProcgenEngine,
  type ProcgenSpec,
} from '@/lib/level-design/procgen-spec';
import { generatePreview } from '@/lib/level-design/procgen-preview';

const BASE = {
  algorithm: 'cellular',
  levelType: 'dungeon',
  gridWidth: 32,
  gridHeight: 32,
  roomCountMin: 6,
  roomCountMax: 12,
  corridorWidth: 3,
  seed: '149',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
    ensureConnected: false,
  },
} as const;

const spec = (over: Partial<Parameters<typeof buildProcgenSpec>[0]> = {}): ProcgenSpec =>
  buildProcgenSpec({ ...BASE, ...over });

const previewOf = (s: ProcgenSpec) => generatePreview(previewConfigFromSpec(s));

describe('exportProcgenGrid — a self-describing, versioned artifact', () => {
  it('declares its exact top-level shape, in order', () => {
    const s = spec();
    const artifact = exportProcgenGrid(s, previewOf(s));
    expect(Object.keys(artifact)).toEqual([...PROCGEN_GRID_EXPORT_FIELDS]);
    expect(artifact.version).toBe(PROCGEN_GRID_EXPORT_VERSION);
    expect(artifact.generatedBy).toBe('browser-preview');
  });

  it('carries the seed, the algorithm and the size the designer asked for', () => {
    const s = spec();
    const preview = previewOf(s);
    const artifact = exportProcgenGrid(s, preview);
    expect(artifact.algorithm).toBe('cellular');
    expect(artifact.seedLabel).toBe('149');
    expect(artifact.seedValue).toBe(preview.seedValue);
    expect(artifact.requestedWidth).toBe(32);
    expect(artifact.width).toBe(preview.width);
    expect(artifact.cells).toHaveLength(preview.height);
  });

  it('records BOTH the spec fields the preview consumed and the ones it ignored', () => {
    const s = spec();
    const artifact = exportProcgenGrid(s, previewOf(s));
    // Cellular reads neither the room band nor the corridor width.
    expect(artifact.specFieldsIgnored).toContain('roomBand');
    expect(artifact.specFieldsIgnored).toContain('corridorWidth');
    expect(artifact.specFieldsConsumed).toContain('algorithm');
    expect(artifact.specFieldsConsumed).toContain('seed');
    // The two sets partition the spec — nothing is silently unaccounted for.
    const union = [...artifact.specFieldsConsumed, ...artifact.specFieldsIgnored].sort();
    expect(new Set(union).size).toBe(union.length);
    expect(union.length).toBeGreaterThan(0);
  });

  it('states the rung of its own parity claim, unverified half included', () => {
    const s = spec();
    const { parity } = exportProcgenGrid(s, previewOf(s));
    expect(parity.engine).toBe('grid-replay');
    expect(parity.agreesWith).toBe('browser-preview');
    expect(parity.provenClaim).toMatch(/by construction/);
    expect(parity.unverified).toMatch(/UNVERIFIED/);
    expect(parity.unverified).toMatch(/no live replay/i);
  });

  it('carries the connectivity report when the repair pass ran', () => {
    const repaired = spec({ constraints: { ...BASE.constraints, ensureConnected: true } });
    const artifact = exportProcgenGrid(repaired, previewOf(repaired));
    expect(artifact.connectPass).not.toBeNull();
    expect(artifact.connectPass!.tunnelsCarved).toBe(1);
    // …and nothing at all when it was never asked for.
    const plain = spec();
    expect(exportProcgenGrid(plain, previewOf(plain)).connectPass).toBeNull();
  });

  it('names the file after the spec it came from', () => {
    expect(procgenGridExportFilename(spec())).toBe('procgen-cellular-32x32-149.json');
    expect(procgenGridExportFilename(spec({ seed: 'dark keep!' })))
      .toBe('procgen-cellular-32x32-dark-keep.json');
  });
});

describe('round trip — the replayed grid IS the preview grid', () => {
  it('reproduces every cell, for every algorithm', () => {
    for (const algorithm of ['bsp', 'wfc', 'cellular', 'perlin'] as const) {
      const s = spec({ algorithm });
      const preview = previewOf(s);
      const back = importProcgenGrid(JSON.parse(JSON.stringify(exportProcgenGrid(s, preview))));
      expect(back.ok, `${algorithm}: ${back.ok ? '' : back.error}`).toBe(true);
      if (!back.ok) continue;
      expect(back.data.width).toBe(preview.width);
      expect(back.data.height).toBe(preview.height);
      expect(back.data.grid).toEqual(preview.grid);
      expect(back.data.rooms).toEqual(preview.rooms);
    }
  });

  it('survives a repaired grid too', () => {
    const s = spec({ constraints: { ...BASE.constraints, ensureConnected: true } });
    const preview = previewOf(s);
    const back = importProcgenGrid(exportProcgenGrid(s, preview));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.data.grid).toEqual(preview.grid);
  });

  it('uses one glyph per cell type, all distinct', () => {
    const glyphs = Object.values(CELL_GLYPHS);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    for (const g of glyphs) expect(g).toHaveLength(1);
  });
});

describe('importProcgenGrid refuses rather than degrades', () => {
  const s = spec();
  const good = () => JSON.parse(JSON.stringify(exportProcgenGrid(s, previewOf(s))));
  const errorOf = (mutate: (a: Record<string, unknown>) => void): string => {
    const a = good();
    mutate(a);
    const r = importProcgenGrid(a);
    expect(r.ok).toBe(false);
    return r.ok ? '' : r.error;
  };

  it('rejects a non-object', () => {
    expect(importProcgenGrid(null).ok).toBe(false);
    expect(importProcgenGrid('grid').ok).toBe(false);
  });

  it('rejects an unknown version, naming it', () => {
    expect(errorOf((a) => { a.version = 99; })).toMatch(/version 99/);
  });

  it('rejects a row count that contradicts the declared height', () => {
    expect(errorOf((a) => { (a.cells as string[]).pop(); })).toMatch(/height/);
  });

  it('rejects a short row, naming the row', () => {
    expect(errorOf((a) => { (a.cells as string[])[3] = 'FF'; })).toMatch(/Row 3/);
  });

  it('rejects a glyph the legend does not define', () => {
    expect(errorOf((a) => {
      const cells = a.cells as string[];
      cells[0] = '?' + cells[0].slice(1);
    })).toMatch(/glyph '\?'/);
  });
});

describe("layoutAgreement — grid-replay is the ONE exact pair, and says at what rung", () => {
  const engines = Object.keys(PROCGEN_ENGINES) as ProcgenEngine[];

  it('agrees with the browser preview, by construction, and states the unverified half', () => {
    const r = layoutAgreement('browser-preview', 'grid-replay');
    expect(r.agree).toBe(true);
    expect(r.reason).toMatch(/by construction/);
    expect(r.reason).toMatch(/UNVERIFIED/);
    // Symmetric — the direction of the question cannot change the answer.
    expect(layoutAgreement('grid-replay', 'browser-preview')).toEqual(r);
  });

  it('is the ONLY agreeing cross-engine pair — nothing else was promoted', () => {
    const agreeing: string[] = [];
    for (const a of engines) {
      for (const b of engines) {
        if (a === b) continue;
        if (layoutAgreement(a, b).agree) agreeing.push([a, b].sort().join('|'));
      }
    }
    expect([...new Set(agreeing)]).toEqual(['browser-preview|grid-replay']);
  });

  it('leaves the UE regenerating engines exactly where they were', () => {
    for (const other of ['ue-arpg-generator', 'llm-codegen'] as const) {
      expect(layoutAgreement('grid-replay', other).agree).toBe(false);
      expect(layoutAgreement('browser-preview', other).agree).toBe(false);
    }
  });

  it('reads no spec field, because the spec is already baked into the cells', () => {
    expect(PROCGEN_ENGINES['grid-replay'].reads).toEqual([]);
    expect(PROCGEN_ENGINES['grid-replay'].determinism).toBe('deterministic');
  });
});

describe('the UE replay script is pinned to the JSON this module writes', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'ue', 'procgen_replay.py');
  const source = readFileSync(scriptPath, 'utf8');

  it('requires EXACTLY the fields the exporter writes, in the same order', () => {
    const block = /REQUIRED_FIELDS = \(([\s\S]*?)\)/.exec(source);
    expect(block, 'REQUIRED_FIELDS tuple not found in procgen_replay.py').not.toBeNull();
    const fields = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(fields).toEqual([...PROCGEN_GRID_EXPORT_FIELDS]);
  });

  it('supports exactly the version the exporter stamps', () => {
    const m = /SUPPORTED_VERSION = (\d+)/.exec(source);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(PROCGEN_GRID_EXPORT_VERSION);
  });

  it('knows every cell type the legend can produce', () => {
    const cellsInScript = new Set([
      ...[...(/FLOOR_CELLS = frozenset\(\(([^)]*)\)\)/.exec(source)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]),
      ...[...(/WALL_CELLS = frozenset\(\(([^)]*)\)\)/.exec(source)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]),
      'empty', // deliberately places nothing
    ]);
    for (const cell of Object.keys(CELL_GLYPHS)) expect(cellsInScript.has(cell)).toBe(true);
  });

  it('states, in the file itself, that it has never been run', () => {
    expect(source).toMatch(/NOT VERIFIED/);
    expect(source).toMatch(/THIS SCRIPT HAS NEVER BEEN RUN/);
  });
});
