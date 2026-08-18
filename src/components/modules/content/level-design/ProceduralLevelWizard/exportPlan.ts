/**
 * What a Blender export will ACTUALLY contain — computed before the operator
 * confirms it.
 *
 * The export used to ship the interactive PREVIEW grid, which is capped at
 * `DEFAULT_MAX_PREVIEW_SIZE` (96) so slider drags stay smooth. For the
 * 256x256 open-world default that meant exporting a 96x96 level while every
 * number on screen said 256x256 — a silent 37% downscale, and the scale badge
 * that knew about it lived in a component the export flow never consulted.
 *
 * The export now REGENERATES at the requested size, bounded by
 * {@link MAX_EXPORT_SIZE}, and this module states the resulting dimensions,
 * scale, seed and object count so the confirm step can show them first.
 *
 * Pure: no React, no Blender, no I/O.
 */
import type { CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { FLOOR_CELL_TYPES } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import type { SpawnPlacement } from './spawnPlacement';

/**
 * Longest side an export may regenerate to. 256 covers every level-type default
 * (the largest is open-world 256x256) at full size; measured generation cost for
 * a 256x256 grid is 8-25ms across all four algorithms, so this is bounded work,
 * not a hidden stall. Above it the export downscales — and SAYS so.
 */
export const MAX_EXPORT_SIZE = 256;

/** Blender world units per grid cell, and wall height, used by the geometry script. */
export const EXPORT_CELL_SIZE = 2;
export const EXPORT_WALL_HEIGHT = 3;

/**
 * Object count above which the export is flagged heavy. The generated script
 * issues one `bpy.ops.*_add` per non-empty cell, and bpy.ops slows down as the
 * scene grows — so a large grid is a genuinely long Blender operation and the
 * operator deserves to know before confirming, not after.
 */
export const HEAVY_OBJECT_COUNT = 20_000;

const FLOOR: ReadonlySet<CellType> = new Set(FLOOR_CELL_TYPES);

export interface ExportPlan {
  algorithm: string;
  /** Size the operator configured. */
  requestedWidth: number;
  requestedHeight: number;
  /** Size that will actually be exported. */
  width: number;
  height: number;
  /** Exported cells per requested cell: 1 = full size, <1 = downscaled. */
  scale: number;
  isFullSize: boolean;
  /** Blender objects the script will create (one per floor cell + one per wall cell). */
  objectCount: number;
  isHeavy: boolean;
  /** Raw seed text the operator typed (may be empty). */
  seedLabel: string;
  /** The int32 seed actually fed to FRandomStream. */
  seedValue: number;
  /** The bound that produced `width`/`height` when they are not full size. */
  cap: number;
}

/** Count the cells the geometry script emits an object for. */
export function countExportObjects(grid: CellType[][]): number {
  let n = 0;
  for (const line of grid) {
    for (const cell of line) {
      if (FLOOR.has(cell) || cell === 'wall') n++;
    }
  }
  return n;
}

export function buildExportPlan(args: {
  algorithm: string;
  requestedWidth: number;
  requestedHeight: number;
  grid: CellType[][];
  scale: number;
  seedLabel: string;
  seedValue: number;
  cap?: number;
}): ExportPlan {
  const height = args.grid.length;
  const width = args.grid[0]?.length ?? 0;
  const objectCount = countExportObjects(args.grid);
  return {
    algorithm: args.algorithm,
    requestedWidth: args.requestedWidth,
    requestedHeight: args.requestedHeight,
    width,
    height,
    scale: args.scale,
    // Judged from the GRID, not from the scale the generator reported — the
    // exported dimensions are the thing the operator is being asked to confirm.
    isFullSize: width === args.requestedWidth && height === args.requestedHeight,
    objectCount,
    isHeavy: objectCount > HEAVY_OBJECT_COUNT,
    seedLabel: args.seedLabel,
    seedValue: args.seedValue,
    cap: args.cap ?? MAX_EXPORT_SIZE,
  };
}

/** Percent form of the scale, e.g. `37%`. */
export function scalePercent(plan: ExportPlan): string {
  return `${Math.round(plan.scale * 100)}%`;
}

/**
 * The one line the operator must read before confirming. It names the size that
 * will be exported first, and — when that is not what they configured — says so
 * in the same breath rather than leaving it to a badge elsewhere on the page.
 */
export function describeExportPlan(plan: ExportPlan): string {
  const size = `${plan.width}x${plan.height}`;
  if (plan.isFullSize) {
    return `Exports ${size} cells — the full requested size (scale 100%).`;
  }
  return (
    `Exports ${size} cells — DOWNSCALED from the requested ` +
    `${plan.requestedWidth}x${plan.requestedHeight} (scale ${scalePercent(plan)}), ` +
    `because the export is bounded to ${plan.cap} cells per side.`
  );
}

/** Plain statement of where the spawn markers ended up. */
export function describeSpawnPlacement(placement: SpawnPlacement): string {
  const { spawns, unplaced } = placement;
  if (spawns.length === 0 && unplaced.length === 0) return 'No spawn markers requested.';

  const parts: string[] = [];
  if (spawns.length > 0) {
    parts.push(`${spawns.length} spawn marker${spawns.length === 1 ? '' : 's'} on floor cells.`);
    // The two move causes are reported separately — a marker nudged aside by
    // another marker was never on a wall, and saying it was would invent terrain.
    const offWall = spawns.filter((s) => s.moveReason === 'off-wall');
    const bumped = spawns.filter((s) => s.moveReason === 'occupied');
    if (offWall.length > 0) {
      parts.push(
        `Moved off a wall: ${offWall.map((s) => `${s.type} +${s.movedBy}`).join(', ')}.`,
      );
    }
    if (bumped.length > 0) {
      parts.push(
        `Moved to avoid another marker: ${bumped.map((s) => `${s.type} +${s.movedBy}`).join(', ')}.`,
      );
    }
  }
  for (const u of unplaced) {
    parts.push(`No ${u.type} marker — ${u.reason}.`);
  }
  return parts.join(' ');
}
