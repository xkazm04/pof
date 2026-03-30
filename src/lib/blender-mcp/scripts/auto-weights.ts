import { py } from '@/lib/blender-mcp/escape';

export function autoWeightsScript(params: {
  armatureName: string;
  meshName: string;
}): string {
  return `
import bpy

armature = bpy.data.objects.get("${py(params.armatureName)}")
mesh = bpy.data.objects.get("${py(params.meshName)}")
if not armature or not mesh:
    raise ValueError("Armature or mesh not found")

bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = armature
mesh.select_set(True)
armature.select_set(True)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

print(f"Auto weights applied: {mesh.name} -> {armature.name}")
`.trim();
}
