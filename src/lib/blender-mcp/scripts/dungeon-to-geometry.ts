export type CellType = 'empty' | 'floor' | 'wall' | 'door' | 'corridor';

export function dungeonToGeometryScript(params: {
  grid: CellType[][];
  cellSize: number;
  wallHeight: number;
}): string {
  const rows = params.grid.length;
  const cols = params.grid[0]?.length ?? 0;
  const typeMap: Record<CellType, number> = {
    empty: 0,
    floor: 1,
    wall: 2,
    door: 3,
    corridor: 4,
  };
  const flatGrid = params.grid
    .flat()
    .map((c) => typeMap[c])
    .join(',');

  return `
import bpy

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

        if cell in (1, 3, 4):  # floor, door, corridor
            bpy.ops.mesh.primitive_plane_add(size=cell_size, location=(x, y, 0))
            obj = bpy.context.active_object
            obj.name = f"Floor_{r}_{c}"
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

        if cell == 2:  # wall
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, wall_height / 2))
            obj = bpy.context.active_object
            obj.name = f"Wall_{r}_{c}"
            obj.scale = (cell_size / 2, cell_size / 2, wall_height / 2)
            bpy.ops.object.transform_apply(scale=True)
            collection.objects.link(obj)
            bpy.context.scene.collection.objects.unlink(obj)

print(f"Created dungeon: {rows}x{cols} grid")
`.trim();
}
