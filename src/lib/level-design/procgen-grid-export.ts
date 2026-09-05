/**
 * The procgen grid as DATA — the one path where "the same seed produces the
 * same layout in UE" is a fact rather than an aspiration.
 *
 * Every other engine in `procgen-spec` REGENERATES a layout from the seed:
 * `ARPGLevelGenerator` places room-template actors from a pool, and the C++
 * codegen path is authored freehand by an LLM. A seed can only ever mean "the
 * same input", never "the same map". So this module stops regenerating and
 * ships the cells: {@link exportProcgenGrid} writes the preview's own grid as a
 * versioned, self-describing artifact, `scripts/ue/procgen_replay.py` REPLAYS
 * it, and the corresponding engine is `grid-replay`.
 *
 * **The rung the parity claim is made at.** Layout parity for `grid-replay` is
 * exact *by construction on the DATA*: `importProcgenGrid(exportProcgenGrid(x))`
 * reproduces the preview grid cell-for-cell, which is tested. **Runtime
 * placement in UE is UNVERIFIED** — no UE run has been observed for this path,
 * and the export says so in its own `parity` block so a reader of the file
 * alone cannot over-read it. `grid-replay`'s agreement with `ue-arpg-generator`
 * and `llm-codegen` is unchanged: still false.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract` ("a seed is a contract, and contracts state their
 * limits"; a stored plan, not a re-run generator, is the authority) and
 * `declare-what-each-engine-ignores` (the artifact carries the consumed AND the
 * ignored spec fields, so a consumer never has to guess which inputs mattered).
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { type Result, ok, err } from '@/types/result';
import type { PreviewResult, PreviewRoom } from './procgen-preview';
import type { ConnectPassReport } from './procgen-connect';
import {
  specFieldsIgnoredBy,
  PROCGEN_SPEC_FIELDS,
  type ProcgenSpec,
  type ProcgenSpecField,
} from './procgen-spec';

/**
 * Bumped whenever the artifact's SHAPE or the meaning of a field changes. A
 * consumer that does not recognise the version must refuse the file rather than
 * guess — `scripts/ue/procgen_replay.py` does exactly that.
 */
export const PROCGEN_GRID_EXPORT_VERSION = 1;

/** Cell type ⇄ one character, so a 256x256 grid is 256 short strings. */
export const CELL_GLYPHS: Readonly<Record<CellType, string>> = {
  empty: '.',
  wall: '#',
  floor: 'F',
  corridor: 'C',
  door: 'D',
};

const GLYPH_TO_CELL: Readonly<Record<string, CellType>> = Object.fromEntries(
  (Object.entries(CELL_GLYPHS) as [CellType, string][]).map(([cell, glyph]) => [glyph, cell]),
);

/** How honest the artifact is about what has actually been observed. */
export interface ProcgenGridParity {
  /** The engine that replays this file. */
  engine: 'grid-replay';
  /** The engine whose output this file IS. */
  agreesWith: 'browser-preview';
  /** What is proven, and by what. */
  provenClaim: string;
  /** What is NOT proven — never omitted, never softened. */
  unverified: string;
}

export interface ProcgenGridExport {
  version: number;
  generatedBy: 'browser-preview';
  algorithm: string;
  levelType: string;
  seedLabel: string;
  seedValue: number;
  /** The grid's real dimensions — the ones `cells` actually has. */
  width: number;
  height: number;
  /** The size the designer asked for, before any preview cap. */
  requestedWidth: number;
  requestedHeight: number;
  /** Exported cells per requested cell (< 1 when the grid was downscaled). */
  scale: number;
  /** glyph → cell type, so the file is readable without this module. */
  cellLegend: Record<string, CellType>;
  /** One string per row, `width` glyphs each, top row first. */
  cells: string[];
  rooms: PreviewRoom[];
  /** Spec fields the browser preview READ to make these cells. */
  specFieldsConsumed: ProcgenSpecField[];
  /** Spec fields it ignored — declared, so a consumer never infers them. */
  specFieldsIgnored: ProcgenSpecField[];
  /** The connectivity repair report, or null when no pass was requested. */
  connectPass: ConnectPassReport | null;
  parity: ProcgenGridParity;
}

/**
 * The artifact's top-level field names, in order — the CONTRACT the UE replay
 * script is pinned to. A test compares this list against the script's own
 * `REQUIRED_FIELDS`, so renaming a field here fails the build rather than
 * silently breaking a script nobody runs in CI.
 */
export const PROCGEN_GRID_EXPORT_FIELDS = [
  'version', 'generatedBy', 'algorithm', 'levelType', 'seedLabel', 'seedValue',
  'width', 'height', 'requestedWidth', 'requestedHeight', 'scale',
  'cellLegend', 'cells', 'rooms', 'specFieldsConsumed', 'specFieldsIgnored',
  'connectPass', 'parity',
] as const satisfies readonly (keyof ProcgenGridExport)[];

const PROVEN_CLAIM =
  'These cells ARE the browser preview\'s grid. Replaying them reproduces that layout exactly, by construction — nothing is regenerated from the seed.';
const UNVERIFIED =
  'Runtime placement in Unreal is UNVERIFIED: no live replay has been observed. Agreement with ue-arpg-generator and llm-codegen is unchanged (false) — they regenerate their own layouts.';

/** Serialise a preview grid into the replay artifact. Pure; no I/O. */
export function exportProcgenGrid(spec: ProcgenSpec, preview: PreviewResult): ProcgenGridExport {
  const ignored = specFieldsIgnoredBy('browser-preview', spec);
  const ignoredSet = new Set<ProcgenSpecField>(ignored);
  return {
    version: PROCGEN_GRID_EXPORT_VERSION,
    generatedBy: 'browser-preview',
    algorithm: spec.algorithm,
    levelType: spec.levelType,
    seedLabel: spec.seedLabel,
    seedValue: preview.seedValue,
    width: preview.width,
    height: preview.height,
    requestedWidth: spec.gridWidth,
    requestedHeight: spec.gridHeight,
    scale: preview.scale,
    cellLegend: { ...GLYPH_TO_CELL },
    cells: preview.grid.map((row) => row.map((cell) => CELL_GLYPHS[cell]).join('')),
    rooms: preview.rooms.map((r) => ({ ...r })),
    specFieldsConsumed: PROCGEN_SPEC_FIELDS.filter((f) => !ignoredSet.has(f)),
    specFieldsIgnored: ignored,
    connectPass: preview.stats.connectPass,
    parity: {
      engine: 'grid-replay',
      agreesWith: 'browser-preview',
      provenClaim: PROVEN_CLAIM,
      unverified: UNVERIFIED,
    },
  };
}

export interface ImportedProcgenGrid {
  grid: CellType[][];
  width: number;
  height: number;
  rooms: PreviewRoom[];
}

/**
 * Read an artifact back into a grid. Every failure is an explicit `Result`
 * error naming the offending field — an unreadable plan must not degrade into
 * a plausible-looking one.
 */
export function importProcgenGrid(data: unknown): Result<ImportedProcgenGrid, string> {
  if (typeof data !== 'object' || data === null) return err('Not a procgen grid export object.');
  const raw = data as Partial<ProcgenGridExport>;

  if (raw.version !== PROCGEN_GRID_EXPORT_VERSION) {
    return err(`Unsupported export version ${String(raw.version)} — this build reads version ${PROCGEN_GRID_EXPORT_VERSION}.`);
  }
  const { width, height, cells } = raw;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return err('Export is missing a positive width/height.');
  }
  if (!Array.isArray(cells) || cells.length !== height) {
    return err(`Export declares height ${height} but carries ${Array.isArray(cells) ? cells.length : 0} rows.`);
  }
  const legend: Record<string, CellType> =
    raw.cellLegend && typeof raw.cellLegend === 'object' ? raw.cellLegend : GLYPH_TO_CELL;

  const grid: CellType[][] = [];
  for (let y = 0; y < height; y++) {
    const row = cells[y];
    if (typeof row !== 'string' || row.length !== width) {
      return err(`Row ${y} is not a string of ${width} glyphs.`);
    }
    const out: CellType[] = [];
    for (let x = 0; x < width; x++) {
      const cell = legend[row[x]];
      if (cell === undefined) return err(`Row ${y} column ${x} uses glyph '${row[x]}', which the legend does not define.`);
      out.push(cell);
    }
    grid.push(out);
  }

  const rooms: PreviewRoom[] = Array.isArray(raw.rooms) ? raw.rooms.map((r) => ({ ...r })) : [];
  return ok({ grid, width, height, rooms });
}

/** A stable, filesystem-safe name for a downloaded artifact. */
export function procgenGridExportFilename(spec: ProcgenSpec): string {
  const label = spec.seedLabel.trim() === '' ? String(spec.seedValue) : spec.seedLabel.trim();
  const safe = label.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'seed';
  return `procgen-${spec.algorithm}-${spec.gridWidth}x${spec.gridHeight}-${safe}.json`;
}
