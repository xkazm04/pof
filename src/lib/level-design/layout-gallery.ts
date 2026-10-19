/**
 * Judge layouts side by side, not one at a time.
 *
 * The wizard shows one grid and forgets it on every slider move or reseed, while
 * `findLayoutRemedies` already generates 64 neighbouring seeds per diagnosis and
 * keeps only three connected ones as text. This module turns that into a
 * surface: {@link scanSeeds} returns a contact sheet of the next seeds with a
 * small thumbnail each, and {@link compareLayouts} states what a pinned layout
 * and the live one differ by.
 *
 * Everything here is pure and deterministic over `generatePreview`, always at
 * the preview cap (<= DEFAULT_MAX_PREVIEW_SIZE per side) — a sheet is a
 * judgement of PARAMETERS, never an export-size generation.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { normalizeRoomBand } from './algo-params';
import { generatePreview, type PreviewStats } from './procgen-preview';
import { previewConfigFromSpec, specFieldsIgnoredBy, type ProcgenSpec } from './procgen-spec';
import { specAtSeed } from './layout-remedies';

/** Candidates on one contact sheet. */
export const GALLERY_COUNT = 12;
/** Longest side of a thumbnail grid, in cells. */
export const THUMB_MAX_SIDE = 32;

export interface LayoutThumb {
  grid: CellType[][];
  width: number;
  height: number;
}

export interface GalleryCandidate {
  /** What to type into the seed field; hashes to `seedValue`. */
  seedLabel: string;
  seedValue: number;
  /** Distance from the scanned spec's seed (1-based). */
  offset: number;
  /** The exact stats the live preview shows after adopting this candidate. */
  stats: PreviewStats;
  thumb: LayoutThumb;
}

/** Passable cells win a block so a thin corridor survives downsampling. */
const BLOCK_RANK: Record<CellType, number> = { empty: 0, wall: 1, floor: 2, corridor: 3, door: 4 };

/** Nearest-block downsample to at most {@link THUMB_MAX_SIDE} cells on the long side. */
export function downsampleGrid(grid: CellType[][], width: number, height: number): LayoutThumb {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / THUMB_MAX_SIDE));
  if (step === 1) return { grid: grid.map((row) => row.slice()), width, height };
  const w = Math.ceil(width / step);
  const h = Math.ceil(height / step);
  const out: CellType[][] = [];
  for (let y = 0; y < h; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < w; x++) {
      let best: CellType = 'empty';
      for (let dy = 0; dy < step && y * step + dy < height; dy++) {
        for (let dx = 0; dx < step && x * step + dx < width; dx++) {
          const c = grid[y * step + dy][x * step + dx];
          if (BLOCK_RANK[c] > BLOCK_RANK[best]) best = c;
        }
      }
      row.push(best);
    }
    out.push(row);
  }
  return { grid: out, width: w, height: h };
}

/**
 * The next `count` seeds after the spec's own, each generated at the preview cap.
 * Ranked by room count nearest the band midpoint when the algorithm reads the
 * band, else by offset.
 */
export function scanSeeds(spec: ProcgenSpec, { count = GALLERY_COUNT }: { count?: number } = {}): GalleryCandidate[] {
  const out: GalleryCandidate[] = [];
  for (let offset = 1; offset <= count; offset++) {
    const at = specAtSeed(spec, (spec.seedValue + offset) | 0);
    const result = generatePreview(previewConfigFromSpec(at));
    out.push({
      seedLabel: at.seedLabel,
      seedValue: at.seedValue,
      offset,
      stats: result.stats,
      thumb: downsampleGrid(result.grid, result.width, result.height),
    });
  }
  const bandLive = !specFieldsIgnoredBy('browser-preview', spec).includes('roomBand');
  if (!bandLive) return out;
  const band = normalizeRoomBand(spec.roomCountMin, spec.roomCountMax);
  const mid = (band.min + band.max) / 2;
  return out.sort((a, b) => Math.abs(a.stats.roomCount - mid) - Math.abs(b.stats.roomCount - mid) || a.offset - b.offset);
}

export interface LayoutComparison {
  /** live minus pinned, per stat; the sign says which way the live layout moved. */
  deltas: { roomCount: number; connectivity: number; floorRatio: number; regions: number };
  /** Only connectivity and region count have a better side; room count and floor ratio are taste. */
  better: 'pinned' | 'live' | null;
}

export function compareLayouts(pinned: PreviewStats, live: PreviewStats): LayoutComparison {
  const deltas = {
    roomCount: live.roomCount - pinned.roomCount,
    connectivity: live.connectivity - pinned.connectivity,
    floorRatio: live.floorRatio - pinned.floorRatio,
    regions: live.regions - pinned.regions,
  };
  // Fewer regions wins first; connectivity breaks a tie.
  const score = deltas.regions !== 0 ? -deltas.regions : deltas.connectivity;
  return { deltas, better: score > 0 ? 'live' : score < 0 ? 'pinned' : null };
}
