import type { TerrainBasis } from '@/lib/visual-gen/generators/terrain';
import { describeTerrainBasis } from '@/lib/visual-gen/generators/terrain';

/**
 * Emit the Blender script that turns a heightfield into a mesh.
 *
 * Horizontal spacing is the DECLARED cell size, never `grid_size / max(rows, cols)` —
 * that division was fed the sample count under a different name, so it evaluated to 1 and
 * hid itself: raising the grid to 257 doubled the world's extent and halved every slope
 * with nothing to announce it. Blender's world unit is the metre, so the basis crosses
 * this edge unconverted; the numbers below are metres.
 */
export function terrainToMeshScript(params: {
  heightmap: number[][];
  basis: TerrainBasis;
}): string {
  const rows = params.heightmap.length;
  const cols = params.heightmap[0]?.length ?? 0;
  const flatHeights = params.heightmap.flat().join(',');
  const { cellSizeM, metresPerSampleM } = params.basis;

  return `
import bpy
import bmesh

# Terrain basis: ${describeTerrainBasis(params.basis)}
heights = [${flatHeights}]
rows, cols = ${rows}, ${cols}
spacing_m = ${cellSizeM}
metres_per_sample = ${metresPerSampleM}

mesh = bpy.data.meshes.new("Terrain")
obj = bpy.data.objects.new("Terrain", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()
verts = []
for r in range(rows):
    row_verts = []
    for c in range(cols):
        h = heights[r * cols + c] * metres_per_sample
        v = bm.verts.new((c * spacing_m, r * spacing_m, h))
        row_verts.append(v)
    verts.append(row_verts)

bm.verts.ensure_lookup_table()
for r in range(rows - 1):
    for c in range(cols - 1):
        bm.faces.new([verts[r][c], verts[r][c+1], verts[r+1][c+1], verts[r+1][c]])

bm.to_mesh(mesh)
bm.free()

mesh.update()
print(f"Created terrain: {rows}x{cols} grid at ${cellSizeM} m spacing, {len(mesh.polygons)} faces")
`.trim();
}
