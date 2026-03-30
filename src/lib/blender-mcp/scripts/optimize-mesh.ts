import { py } from '@/lib/blender-mcp/escape';

export function optimizeMeshScript(params: {
  objectName: string;
  removeDoubles?: boolean;
  recalcNormals?: boolean;
  mergeDistance?: number;
}): string {
  const mergeDistance = params.mergeDistance ?? 0.0001;
  return `
import bpy

obj = bpy.data.objects.get("${py(params.objectName)}")
if not obj or obj.type != 'MESH':
    raise ValueError("Object '${py(params.objectName)}' not found or not a mesh")

bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')

initial_verts = len(obj.data.vertices)

${params.removeDoubles !== false ? `# Remove doubles\nbpy.ops.mesh.remove_doubles(threshold=${mergeDistance})` : '# Skip remove doubles'}

${params.recalcNormals !== false ? `# Recalculate normals\nbpy.ops.mesh.normals_make_consistent(inside=False)` : '# Skip recalculate normals'}

bpy.ops.object.mode_set(mode='OBJECT')

final_verts = len(obj.data.vertices)
print(f"Optimized {obj.name}: {initial_verts} -> {final_verts} vertices (removed {initial_verts - final_verts})")
`.trim();
}
