/**
 * Live in-browser procgen preview. Runs the BSP / cellular / WFC / Perlin
 * algorithm purely in TypeScript — using the same {@link FRandomStream} seed
 * the UE C++ codegen targets — and returns a `CellType` grid plus derived
 * layout stats (room count + connectivity) so designers can judge a layout
 * instantly, before dispatching the expensive CLI C++ generation task.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { FRandomStream, hashSeed } from './frandom-stream';
import { bspGrid, cellularGrid, wfcGrid, perlinGrid, type PreviewRoom } from './procgen-algorithms';

export type PreviewAlgorithm = 'bsp' | 'wfc' | 'cellular' | 'perlin';
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
const PASSABLE: ReadonlySet<CellType> = new Set<CellType>(['floor', 'corridor', 'door']);

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

/** Flood-fill the passable cells into connected regions (4-connectivity). */
function analyzeConnectivity(grid: CellType[][], w: number, h: number): { floorCells: number; regions: number; largest: number } {
  const seen = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  let floorCells = 0, regions = 0, largest = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!PASSABLE.has(grid[y][x])) continue;
      floorCells++;
      if (seen[y][x]) continue;
      regions++;
      let size = 0;
      const stack: Array<[number, number]> = [[x, y]];
      seen[y][x] = true;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        size++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny][nx] && PASSABLE.has(grid[ny][nx])) {
            seen[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      if (size > largest) largest = size;
    }
  }
  return { floorCells, regions, largest };
}

const GENERATORS = { bsp: bspGrid, cellular: cellularGrid, wfc: wfcGrid, perlin: perlinGrid } as const;

/** Generate a deterministic preview grid + stats for the given wizard config. */
export function generatePreview(config: PreviewConfig): PreviewResult {
  const cap = config.maxPreviewSize ?? DEFAULT_MAX_PREVIEW_SIZE;
  const { w, h, scale } = fitToPreview(config.gridWidth, config.gridHeight, cap);
  const seedValue = hashSeed(config.seed);
  const rng = new FRandomStream(seedValue);
  const params = {
    roomCountMin: config.roomCountMin,
    roomCountMax: config.roomCountMax,
    corridorWidth: Math.max(1, Math.round(config.corridorWidth * scale)) || 1,
  };

  const { grid, rooms } = GENERATORS[config.algorithm](w, h, params, rng);
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
    },
  };
}
