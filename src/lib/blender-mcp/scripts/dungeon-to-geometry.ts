export type CellType = 'empty' | 'floor' | 'wall' | 'door' | 'corridor';

/** Numeric encoding of {@link CellType} the generated Python switches on. */
export const CELL_TYPE_CODES: Record<CellType, number> = {
  empty: 0,
  floor: 1,
  wall: 2,
  door: 3,
  corridor: 4,
};

/**
 * The cell types this script emits a walkable FLOOR plane for.
 *
 * Exported because it is a contract, not a detail: anything else placed into the
 * level (spawn markers) must land on one of these cells, or it hangs over the
 * void / sits inside a wall block. `spawn-placement` snaps to this exact set, so
 * the two can never drift.
 */
export const FLOOR_CELL_TYPES: readonly CellType[] = ['floor', 'door', 'corridor'];

/** Provenance stamped into the script header — what was asked for vs what this file builds. */
export interface DungeonScriptMeta {
  /** Generator that produced the grid (bsp / wfc / cellular / perlin). */
  algorithm: string;
  /** The grid size the operator configured, before any export bound applied. */
  requestedWidth: number;
  requestedHeight: number;
  /** Exported cells per requested cell: 1 = full size, <1 = downscaled. */
  scale: number;
  /** Raw seed text the operator typed (empty string when they left it blank). */
  seedLabel: string;
  /** The int32 seed actually fed to FRandomStream. */
  seedValue: number;
}

const FLOOR_CODES = FLOOR_CELL_TYPES.map((c) => CELL_TYPE_CODES[c]);

/**
 * A `#` header naming what this script actually builds.
 *
 * The script is an outward-facing artifact — it outlives the wizard session and
 * gets read in Blender's text editor with no UI beside it. So it states the
 * exported grid, the requested grid, the scale between them and the seed: a
 * downscaled export can never be mistaken for the size the operator asked for.
 */
function metaHeader(meta: DungeonScriptMeta, rows: number, cols: number): string {
  const pct = `${Math.round(meta.scale * 100)}%`;
  const sizeLine =
    meta.scale === 1
      ? `# Grid:      ${cols}x${rows} cells (FULL requested size, scale ${pct})`
      : `# Grid:      ${cols}x${rows} cells — DOWNSCALED from the requested ` +
        `${meta.requestedWidth}x${meta.requestedHeight} (scale ${pct})`;
  return [
    '# ─────────────────────────────────────────────────────────────',
    '# PoF procedural level export',
    sizeLine,
    `# Algorithm: ${meta.algorithm}`,
    `# Seed:      ${meta.seedLabel === '' ? '(blank — default seed)' : meta.seedLabel} → ${meta.seedValue}`,
    '# ─────────────────────────────────────────────────────────────',
  ].join('\n');
}

export function dungeonToGeometryScript(params: {
  grid: CellType[][];
  cellSize: number;
  wallHeight: number;
  /** Optional provenance header. Omitted by callers that build a grid directly. */
  meta?: DungeonScriptMeta;
}): string {
  const rows = params.grid.length;
  const cols = params.grid[0]?.length ?? 0;
  const flatGrid = params.grid
    .flat()
    .map((c) => CELL_TYPE_CODES[c])
    .join(',');

  const header = params.meta ? `${metaHeader(params.meta, rows, cols)}\n\n` : '';

  return `${header}import bpy

grid = [${flatGrid}]
rows, cols = ${rows}, ${cols}
cell_size = ${params.cellSize}
wall_height = ${params.wallHeight}

collection = bpy.data.collections.new("Dungeon")
bpy.context.scene.collection.children.link(collection)

for r in range(rows):
    for c in range(cols):
        cell = grid[r * cols + c]
        x, y = c * cell_size, r * cell_size

        if cell in (${FLOOR_CODES.join(', ')}):  # ${FLOOR_CELL_TYPES.join(', ')}
            bpy.ops.mesh.primitive_plane_add(size=cell_size, location=(x, y, 0))
            obj = bpy.context.active_object
            obj.name = f"Floor_{r}_{c}"
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

        if cell == ${CELL_TYPE_CODES.wall}:  # wall
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, wall_height / 2))
            obj = bpy.context.active_object
            obj.name = f"Wall_{r}_{c}"
            obj.scale = (cell_size / 2, cell_size / 2, wall_height / 2)
            bpy.ops.object.transform_apply(scale=True)
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

print(f"Created dungeon: {rows}x{cols} grid")`;
}
