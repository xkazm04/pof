export function terrainToMeshScript(params: {
  heightmap: number[][];
  gridSize: number;
  heightScale: number;
}): string {
  const rows = params.heightmap.length;
  const cols = params.heightmap[0]?.length ?? 0;
  const flatHeights = params.heightmap.flat().join(',');

  return `
import bpy
import bmesh

heights = [${flatHeights}]
rows, cols = ${rows}, ${cols}
grid_size = ${params.gridSize}
height_scale = ${params.heightScale}
spacing = grid_size / max(rows, cols)

mesh = bpy.data.meshes.new("Terrain")
obj = bpy.data.objects.new("Terrain", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()
verts = []
for r in range(rows):
    row_verts = []
    for c in range(cols):
        h = heights[r * cols + c] * height_scale
        v = bm.verts.new((c * spacing, r * spacing, h))
        row_verts.append(v)
    verts.append(row_verts)

bm.verts.ensure_lookup_table()
for r in range(rows - 1):
    for c in range(cols - 1):
        bm.faces.new([verts[r][c], verts[r][c+1], verts[r+1][c+1], verts[r+1][c]])

bm.to_mesh(mesh)
bm.free()

mesh.update()
print(f"Created terrain: {rows}x{cols} grid, {len(mesh.polygons)} faces")
`.trim();
}
