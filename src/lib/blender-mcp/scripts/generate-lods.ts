import { py } from '@/lib/blender-mcp/escape';

export function generateLodsScript(params: {
  objectName: string;
  lodRatios: number[];
}): string {
  const lodSteps = params.lodRatios
    .map(
      (ratio, i) => `
# LOD ${i + 1} (${Math.round(ratio * 100)}% of original)
lod = obj.copy()
lod.data = obj.data.copy()
lod.name = f"{obj.name}_LOD${i + 1}"
bpy.context.collection.objects.link(lod)
bpy.context.view_layer.objects.active = lod
lod.select_set(True)
mod = lod.modifiers.new(name="Decimate", type='DECIMATE')
mod.ratio = ${ratio}
bpy.ops.object.modifier_apply(modifier=mod.name)
lod.select_set(False)
lod.location.x += ${(i + 1) * 3}
print(f"  LOD${i + 1}: {len(lod.data.polygons)} faces (${Math.round(ratio * 100)}%)")
`,
    )
    .join('\n');

  return `
import bpy

obj = bpy.data.objects.get("${py(params.objectName)}")
if not obj or obj.type != 'MESH':
    raise ValueError("Object '${py(params.objectName)}' not found or not a mesh")

bpy.ops.object.select_all(action='DESELECT')
print(f"Generating LODs for {obj.name} ({len(obj.data.polygons)} faces)")
${lodSteps}
print("LOD generation complete")
`.trim();
}
