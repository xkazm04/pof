import { py } from '@/lib/blender-mcp/escape';

/**
 * Emit Blender Python that re-UVs meshes with world-aligned planar projection:
 * each face's world position is projected onto the plane perpendicular to its
 * dominant world-normal axis and divided by `tileMeters`, so one texture
 * repeat equals `tileMeters` of world space everywhere. This gives a single
 * uniform real-world texture scale (no per-face cube-projection grid).
 *
 * - `tileMeters` — world metres per texture repeat (e.g. 4).
 * - `objectNames` — restrict to these objects; omit/empty to re-UV every mesh.
 */
export function worldAlignedUvScript(params: {
  tileMeters: number;
  objectNames?: string[];
}): string {
  const targets = (params.objectNames ?? [])
    .map((n) => `"${py(n)}"`)
    .join(', ');

  return `
import bpy

TILE = ${params.tileMeters}
TARGETS = [${targets}]

def world_aligned_uv(obj):
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    mw = obj.matrix_world
    rot = mw.to_3x3()
    for poly in mesh.polygons:
        n = rot @ poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            co = mw @ mesh.vertices[mesh.loops[li].vertex_index].co
            if az >= ax and az >= ay:      # floor / ceiling -> world XY
                u, v = co.x, co.y
            elif ay >= ax:                  # N/S walls -> world XZ
                u, v = co.x, co.z
            else:                           # E/W walls -> world YZ
                u, v = co.y, co.z
            uv[li].uv = (u / TILE, v / TILE)

count = 0
for obj in bpy.data.objects:
    if obj.type == 'MESH' and (not TARGETS or obj.name in TARGETS):
        world_aligned_uv(obj)
        count += 1

print(f"World-aligned UV applied to {count} mesh(es), tile={TILE}m")
`.trim();
}
