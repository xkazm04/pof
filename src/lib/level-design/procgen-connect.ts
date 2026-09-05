/**
 * The connectivity repair pass for the procgen preview.
 *
 * `PreviewStats.connectivity` has always REPORTED "largest passable region /
 * all passable cells", and the preview verdict has always flagged a cave that
 * came out in pieces — while offering nothing to do about it. This module is
 * the fix half: a deterministic **region-cull + tunnel-carve** pass that turns a
 * fragmented grid into one reachable region.
 *
 * Three things about it are contract, not implementation detail:
 *
 * 1. **It is opt-in.** Nothing calls it unless the spec's `ensureConnected`
 *    constraint is on, so a spec without it produces the byte-identical grid the
 *    generators produced before this module existed.
 * 2. **It reports what it did.** {@link ConnectPassReport} rides in
 *    `PreviewStats.connectPass`, so a connectivity of 1.00 can never be shown
 *    without also showing the regions culled, the tunnels carved and the cells
 *    changed to get there. A linted property states what the lint changed —
 *    registry `procedural-level-planning` / "the plan is a graph, and a graph
 *    can be linted".
 * 3. **Its RNG draw order is part of the seed contract.** The pass draws from
 *    the SAME {@link FRandomStream} the generator used, continuing after the
 *    generator's own draws, and takes **exactly one `randHelper` draw per tunnel
 *    carved** (used to break ties between equidistant merge targets). Culling
 *    draws nothing. So: same seed + same spec => same grid, every run; and
 *    turning the pass on changes the grid only through the pass, never by
 *    shifting draws the generator already made.
 *
 * Phase 1 wires the pass to `cellular` only (see `ensureConnectedSupport` in
 * `algo-params`). It carves through `wall`/`empty` cells and does NOT re-run the
 * generators' `addWalls` step — harmless for caves, which contain no `empty`
 * cells at all, and the reason the other algorithms are declared unsupported
 * rather than quietly repaired.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { FRandomStream } from './frandom-stream';

/** Cells a player can stand on / walk through. The one source for "passable". */
export const PASSABLE_CELLS: ReadonlySet<CellType> = new Set<CellType>(['floor', 'corridor', 'door']);

/** Passable regions smaller than this are noise pockets — culled, not tunneled to. */
export const MIN_REGION_CELLS = 4;

/** Guard against a pathological grid spinning the merge loop forever. */
const MAX_MERGES = 64;

/** 4-connectivity, in a FIXED order — the BFS below is deterministic because of it. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface RegionMap {
  /** Region index per cell (row-major), or -1 for an impassable cell. */
  labels: Int32Array;
  /** Cell count per region index. */
  sizes: number[];
}

/** Label every passable cell with its connected region (4-connectivity). */
export function labelRegions(grid: CellType[][], w: number, h: number): RegionMap {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!PASSABLE_CELLS.has(grid[y][x]) || labels[y * w + x] !== -1) continue;
      const id = sizes.length;
      let size = 0;
      const stack: number[] = [y * w + x];
      labels[y * w + x] = id;
      while (stack.length > 0) {
        const idx = stack.pop()!;
        size++;
        const cx = idx % w, cy = (idx - cx) / w;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (labels[n] !== -1 || !PASSABLE_CELLS.has(grid[ny][nx])) continue;
          labels[n] = id;
          stack.push(n);
        }
      }
      sizes.push(size);
    }
  }
  return { labels, sizes };
}

/** Index of the biggest region, or -1 when there are none. Ties go to the lowest index. */
function largestRegion(sizes: number[]): number {
  let best = -1, bestSize = -1;
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] > bestSize) { bestSize = sizes[i]; best = i; }
  }
  return best;
}

/** What the pass did — never absent when connectivity is claimed to be repaired. */
export interface ConnectPassReport {
  /** False when the pass was requested but not run (see `skippedReason`). */
  applied: boolean;
  /** '' when applied; otherwise why this algorithm is not repaired. */
  skippedReason: string;
  /** Passable regions found before the pass touched anything. */
  regionsBefore: number;
  /** Passable regions left after the pass (1 whenever it repaired successfully). */
  regionsAfter: number;
  /** Noise pockets (< MIN_REGION_CELLS) filled in as wall. */
  regionsCulled: number;
  cellsCulled: number;
  /** Tunnels drilled to merge a surviving region into the main one. */
  tunnelsCarved: number;
  cellsCarved: number;
  /** cellsCulled + cellsCarved — every cell whose type the pass changed. */
  cellsChanged: number;
  /** FRandomStream draws the pass consumed. Exactly one per tunnel carved. */
  rngDraws: number;
}

/** A report for a request the pass declined to run, so the UI still has facts. */
export function skippedConnectPass(reason: string, regionsBefore: number): ConnectPassReport {
  return {
    applied: false,
    skippedReason: reason,
    regionsBefore,
    regionsAfter: regionsBefore,
    regionsCulled: 0,
    cellsCulled: 0,
    tunnelsCarved: 0,
    cellsCarved: 0,
    cellsChanged: 0,
    rngDraws: 0,
  };
}

/**
 * Make every passable cell reachable from every other, IN PLACE.
 *
 * Culls pockets below {@link MIN_REGION_CELLS}, then repeatedly BFS-drills the
 * shortest tunnel from the largest region to the nearest surviving region until
 * one region remains. Returns the {@link ConnectPassReport} for the stats.
 */
export function ensureConnectedPass(
  grid: CellType[][],
  w: number,
  h: number,
  rng: FRandomStream,
): ConnectPassReport {
  const initial = labelRegions(grid, w, h);
  const regionsBefore = initial.sizes.length;

  // Nothing to repair — and, importantly, nothing drawn from the RNG either.
  if (regionsBefore <= 1) {
    return { ...skippedConnectPass('', regionsBefore), applied: true, regionsAfter: regionsBefore };
  }

  // ── 1. Cull the noise pockets ──
  const keep = largestRegion(initial.sizes);
  let regionsCulled = 0, cellsCulled = 0;
  const cullSet = new Set<number>();
  for (let i = 0; i < initial.sizes.length; i++) {
    if (i !== keep && initial.sizes[i] < MIN_REGION_CELLS) { cullSet.add(i); regionsCulled++; }
  }
  if (cullSet.size > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cullSet.has(initial.labels[y * w + x])) { grid[y][x] = 'wall'; cellsCulled++; }
      }
    }
  }

  // ── 2. Tunnel the survivors into the main region ──
  let tunnelsCarved = 0, cellsCarved = 0, rngDraws = 0;
  let regionsAfter = regionsBefore - regionsCulled;
  for (let merge = 0; merge < MAX_MERGES; merge++) {
    const cur = labelRegions(grid, w, h);
    regionsAfter = cur.sizes.length;
    if (regionsAfter <= 1) break;
    const main = largestRegion(cur.sizes);

    // BFS over EVERY cell (walls included) from the whole main region at once.
    const dist = new Int32Array(w * h).fill(-1);
    const parent = new Int32Array(w * h).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < w * h; i++) if (cur.labels[i] === main) { dist[i] = 0; queue.push(i); }
    for (let head = 0; head < queue.length; head++) {
      const idx = queue[head];
      const cx = idx % w, cy = (idx - cx) / w;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (dist[n] !== -1) continue;
        dist[n] = dist[idx] + 1;
        parent[n] = idx;
        queue.push(n);
      }
    }

    // Nearest cell of ANOTHER region; all ties collected in row-major order.
    let bestDist = Number.MAX_SAFE_INTEGER;
    let targets: number[] = [];
    for (let i = 0; i < w * h; i++) {
      const label = cur.labels[i];
      if (label === -1 || label === main || dist[i] < 0) continue;
      if (dist[i] < bestDist) { bestDist = dist[i]; targets = [i]; }
      else if (dist[i] === bestDist) targets.push(i);
    }
    if (targets.length === 0) break; // unreachable by construction; report what we have

    // The single documented draw per tunnel: which of the tied targets to join.
    const target = targets[rng.randHelper(targets.length)];
    rngDraws++;

    for (let idx = parent[target]; idx !== -1; idx = parent[idx]) {
      const cx = idx % w, cy = (idx - cx) / w;
      if (PASSABLE_CELLS.has(grid[cy][cx])) break; // reached the main region
      grid[cy][cx] = 'corridor';
      cellsCarved++;
    }
    tunnelsCarved++;
  }

  return {
    applied: true,
    skippedReason: '',
    regionsBefore,
    regionsAfter,
    regionsCulled,
    cellsCulled,
    tunnelsCarved,
    cellsCarved,
    cellsChanged: cellsCulled + cellsCarved,
    rngDraws,
  };
}

/** One human sentence for a report — the "how it got there" beside a 100% figure. */
export function describeConnectPass(report: ConnectPassReport): string {
  if (!report.applied) return report.skippedReason;
  if (report.regionsBefore <= 1) return 'Connectivity pass ran and found one region already — nothing changed.';
  const parts: string[] = [];
  if (report.regionsCulled > 0) parts.push(`culled ${report.regionsCulled} pocket${report.regionsCulled === 1 ? '' : 's'} (${report.cellsCulled} cells)`);
  if (report.tunnelsCarved > 0) parts.push(`carved ${report.tunnelsCarved} tunnel${report.tunnelsCarved === 1 ? '' : 's'} (${report.cellsCarved} cells)`);
  const did = parts.length > 0 ? parts.join(' and ') : 'changed nothing';
  return `Connectivity pass: ${report.regionsBefore} regions → ${report.regionsAfter}; ${did}.`;
}
