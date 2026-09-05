/**
 * Live in-browser procgen preview. Runs the BSP / cellular / WFC / Perlin
 * algorithm purely in TypeScript, seeding {@link FRandomStream} with the same
 * seed the UE task is asked to use, and returns a `CellType` grid plus derived
 * layout stats (room count + connectivity) so designers can judge a layout
 * instantly, before dispatching the expensive CLI C++ generation task.
 *
 * **What parity means here, honestly.** This shares the algorithm FAMILY and the
 * seed intent with the C++ path — not its output. The UE side is regenerated
 * freehand by the LLM from `buildProceduralLevelPrompt`, so nothing enforces
 * that it reproduces this exact layout; treat the preview as a judgement of the
 * parameters, not a picture of the map UE will bake. (Making the two provably
 * identical is the parked determinism inversion.)
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { FRandomStream, hashSeed } from './frandom-stream';
import { bspGrid, cellularGrid, wfcGrid, perlinGrid, type PreviewRoom } from './procgen-algorithms';
import { normalizeRoomBand, ensureConnectedSupport, type PreviewAlgorithm } from './algo-params';
import {
  ensureConnectedPass, skippedConnectPass, labelRegions,
  type ConnectPassReport,
} from './procgen-connect';

export type { PreviewAlgorithm };
export type { PreviewRoom };

export interface PreviewConfig {
  algorithm: PreviewAlgorithm;
  gridWidth: number;
  gridHeight: number;
  roomCountMin: number;
  roomCountMax: number;
  corridorWidth: number;
  /** Raw seed text from the wizard (may be empty — falls back to a fixed seed). */
  seed: string;
  /** Cap on the longest preview side; keeps generation in the millisecond range. */
  maxPreviewSize?: number;
  /**
   * Run the region-cull + tunnel-carve pass so every passable cell is
   * reachable. Opt-in: omitted / false reproduces the pre-pass grid exactly.
   */
  ensureConnected?: boolean;
}

export interface PreviewStats {
  /** Explicit room count for room-based algorithms, else connected-region count. */
  roomCount: number;
  floorCells: number;
  /** Passable cells / total cells, 0–1. */
  floorRatio: number;
  /** Largest passable region / all passable cells, 0–1 (1 = fully connected). */
  connectivity: number;
  /** Number of disconnected passable regions. */
  regions: number;
  /**
   * What the connectivity pass did, or null when it was never requested. A
   * connectivity of 1 that the pass produced ALWAYS carries this beside it.
   */
  connectPass: ConnectPassReport | null;
}

export interface PreviewResult {
  grid: CellType[][];
  width: number;
  height: number;
  rooms: PreviewRoom[];
  /** Resolved int32 seed actually fed to {@link FRandomStream}. */
  seedValue: number;
  /** Preview cells per source cell (<1 when the grid was downscaled to fit the cap). */
  scale: number;
  stats: PreviewStats;
}

export const DEFAULT_MAX_PREVIEW_SIZE = 96;

/** Downscale the requested grid so its longest side fits the preview cap. */
function fitToPreview(gridWidth: number, gridHeight: number, cap: number): { w: number; h: number; scale: number } {
  const longest = Math.max(gridWidth, gridHeight);
  if (longest <= cap) return { w: Math.max(8, gridWidth), h: Math.max(8, gridHeight), scale: 1 };
  const scale = cap / longest;
  return {
    w: Math.max(8, Math.round(gridWidth * scale)),
    h: Math.max(8, Math.round(gridHeight * scale)),
    scale,
  };
}

/**
 * Flood-fill the passable cells into connected regions (4-connectivity).
 * Delegates the labelling to `procgen-connect` so the stats and the repair pass
 * can never disagree about what "one region" means.
 */
function analyzeConnectivity(grid: CellType[][], w: number, h: number): { floorCells: number; regions: number; largest: number } {
  const { sizes } = labelRegions(grid, w, h);
  let floorCells = 0, largest = 0;
  for (const size of sizes) {
    floorCells += size;
    if (size > largest) largest = size;
  }
  return { floorCells, regions: sizes.length, largest };
}

const GENERATORS = { bsp: bspGrid, cellular: cellularGrid, wfc: wfcGrid, perlin: perlinGrid } as const;

/** Generate a deterministic preview grid + stats for the given wizard config. */
export function generatePreview(config: PreviewConfig): PreviewResult {
  const cap = config.maxPreviewSize ?? DEFAULT_MAX_PREVIEW_SIZE;
  const { w, h, scale } = fitToPreview(config.gridWidth, config.gridHeight, cap);
  const seedValue = hashSeed(config.seed);
  const rng = new FRandomStream(seedValue);
  // An inverted band is flagged in the wizard and read swapped here, so a
  // mis-dragged pair still previews something rather than collapsing to nothing.
  const band = normalizeRoomBand(config.roomCountMin, config.roomCountMax);
  const params = {
    roomCountMin: band.min,
    roomCountMax: band.max,
    corridorWidth: Math.max(1, Math.round(config.corridorWidth * scale)) || 1,
  };

  const { grid, rooms } = GENERATORS[config.algorithm](w, h, params, rng);

  // The connectivity repair pass, opt-in via the spec's `ensureConnected`
  // constraint. It runs on the SAME FRandomStream, continuing after the
  // generator's draws, so its RNG consumption is appended rather than
  // interleaved: a spec without the toggle produces the identical grid it did
  // before this pass existed, and one with it produces the same repaired grid
  // on every run of the same seed.
  let connectPass: ConnectPassReport | null = null;
  if (config.ensureConnected === true) {
    const unsupported = ensureConnectedSupport(config.algorithm);
    connectPass = unsupported
      ? skippedConnectPass(unsupported, labelRegions(grid, w, h).sizes.length)
      : ensureConnectedPass(grid, w, h, rng);
  }

  const { floorCells, regions, largest } = analyzeConnectivity(grid, w, h);

  return {
    grid,
    width: w,
    height: h,
    rooms,
    seedValue,
    scale,
    stats: {
      roomCount: rooms.length > 0 ? rooms.length : regions,
      floorCells,
      floorRatio: floorCells / (w * h),
      connectivity: floorCells > 0 ? largest / floorCells : 0,
      regions,
      connectPass,
    },
  };
}
