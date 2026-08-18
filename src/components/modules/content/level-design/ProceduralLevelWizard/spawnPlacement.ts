/**
 * Where spawn markers actually go in an exported level.
 *
 * The export used to fabricate spawns at fixed anchors — corner, opposite
 * corner, centre — with no check that the cell was walkable. Every generator
 * here carves rooms out of solid rock, so a corner is a WALL far more often
 * than not: the player marker regularly landed inside geometry or over the void.
 *
 * These functions keep the same anchors (they encode real intent — start near
 * one end, boss at the far end, loot in the middle) but snap each one to the
 * nearest cell the geometry script actually emits a floor for.
 *
 * Pure and grid-only: no React, no Blender, no randomness.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { FLOOR_CELL_TYPES } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { GameplayConstraints } from './types';

/** Walkable cells, taken from the geometry script so the two cannot drift. */
const FLOOR: ReadonlySet<CellType> = new Set(FLOOR_CELL_TYPES);

export interface GridCell {
  col: number;
  row: number;
}

/**
 * Why a marker is not on its intended anchor. Kept distinct because they are
 * different facts: `off-wall` means the layout put rock where the anchor was,
 * `occupied` means another marker got there first. Collapsing them into one
 * "snapped" flag reports a wall that was never there.
 */
export type SpawnMoveReason = 'none' | 'off-wall' | 'occupied';

/** A spawn marker, in Blender world units, with the cell it was placed on. */
export interface PlacedSpawn {
  x: number;
  y: number;
  type: string;
  /** Grid cell the marker sits on — always a floor cell. */
  col: number;
  row: number;
  /** True when the marker is not on its intended anchor, for any reason. */
  snapped: boolean;
  moveReason: SpawnMoveReason;
  /** Chebyshev distance in cells from the intended anchor (0 when unmoved). */
  movedBy: number;
}

export interface SpawnPlacement {
  spawns: PlacedSpawn[];
  /**
   * Spawn types that could NOT be placed, with the reason. A grid with no
   * walkable cell at all cannot carry a marker, and silently dropping it would
   * be the same class of lie as placing it in a wall.
   */
  unplaced: Array<{ type: string; reason: string }>;
}

function isFloor(grid: CellType[][], col: number, row: number): boolean {
  const line = grid[row];
  if (!line) return false;
  const cell = line[col];
  return cell !== undefined && FLOOR.has(cell);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * The walkable cell nearest to `(col, row)`, searched as expanding Chebyshev
 * rings so the result is the closest one and the tie-break is deterministic
 * (within a ring: top row left→right, then side columns top→bottom, then bottom
 * row left→right). Cells in `occupied` are skipped, so two markers never stack.
 *
 * Returns `null` only when the grid holds no free walkable cell at all.
 */
export function nearestFloorCell(
  grid: CellType[][],
  col: number,
  row: number,
  occupied: ReadonlySet<string> = new Set(),
): GridCell | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return null;

  const cx = clamp(Math.round(col), 0, width - 1);
  const cy = clamp(Math.round(row), 0, height - 1);
  const free = (x: number, y: number) => isFloor(grid, x, y) && !occupied.has(cellKey(x, y));

  if (free(cx, cy)) return { col: cx, row: cy };

  const maxRadius = Math.max(width, height);
  for (let r = 1; r <= maxRadius; r++) {
    const top = cy - r;
    const bottom = cy + r;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x >= 0 && x < width && top >= 0 && free(x, top)) return { col: x, row: top };
    }
    for (let y = top + 1; y < bottom; y++) {
      if (y < 0 || y >= height) continue;
      const left = cx - r;
      const right = cx + r;
      if (left >= 0 && free(left, y)) return { col: left, row: y };
      if (right < width && free(right, y)) return { col: right, row: y };
    }
    for (let x = cx - r; x <= cx + r; x++) {
      if (x >= 0 && x < width && bottom < height && free(x, bottom)) return { col: x, row: bottom };
    }
  }
  return null;
}

/** Intended anchor per constraint — unchanged intent, now only a STARTING point. */
const ANCHORS: Array<{
  key: keyof GameplayConstraints;
  type: string;
  at: (width: number, height: number) => GridCell;
}> = [
  { key: 'spawnPoints', type: 'player', at: () => ({ col: 1, row: 1 }) },
  { key: 'bossRoom', type: 'boss', at: (w, h) => ({ col: w - 2, row: h - 2 }) },
  {
    key: 'lootPlacement',
    type: 'loot',
    at: (w, h) => ({ col: Math.floor(w / 2), row: Math.floor(h / 2) }),
  },
];

/**
 * Place every enabled constraint's marker on a real floor cell.
 *
 * `cellSize` converts grid cells to the Blender world units the geometry script
 * uses (`x = col * cellSize`, `y = row * cellSize`), so a marker's coordinates
 * are the centre of the floor plane it stands on — not an independently
 * invented number that happens to look similar.
 */
export function planSpawns(
  grid: CellType[][],
  constraints: GameplayConstraints,
  cellSize: number,
): SpawnPlacement {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const spawns: PlacedSpawn[] = [];
  const unplaced: SpawnPlacement['unplaced'] = [];
  const occupied = new Set<string>();

  for (const anchor of ANCHORS) {
    if (!constraints[anchor.key]) continue;
    const intended = anchor.at(width, height);
    const cell = nearestFloorCell(grid, intended.col, intended.row, occupied);
    if (!cell) {
      unplaced.push({
        type: anchor.type,
        reason: 'no free walkable cell in the generated layout',
      });
      continue;
    }
    occupied.add(cellKey(cell.col, cell.row));
    const ax = clamp(intended.col, 0, Math.max(0, width - 1));
    const ay = clamp(intended.row, 0, Math.max(0, height - 1));
    const movedBy = Math.max(Math.abs(cell.col - ax), Math.abs(cell.row - ay));
    // The anchor was walkable and we still moved ⇒ another marker held it. Only
    // an anchor that is genuinely not walkable counts as moved off a wall.
    const moveReason: SpawnMoveReason =
      movedBy === 0 ? 'none' : isFloor(grid, ax, ay) ? 'occupied' : 'off-wall';
    spawns.push({
      x: cell.col * cellSize,
      y: cell.row * cellSize,
      type: anchor.type,
      col: cell.col,
      row: cell.row,
      snapped: movedBy > 0,
      moveReason,
      movedBy,
    });
  }

  return { spawns, unplaced };
}
