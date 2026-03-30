import { py } from '@/lib/blender-mcp/escape';

export function createMaterialScript(params: {
  name: string;
  baseColor: [number, number, number];
  metallic: number;
  roughness: number;
}): string {
  return `
import bpy

mat = bpy.data.materials.new(name="${py(params.name)}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (${params.baseColor[0]}, ${params.baseColor[1]}, ${params.baseColor[2]}, 1.0)
bsdf.inputs["Metallic"].default_value = ${params.metallic}
bsdf.inputs["Roughness"].default_value = ${params.roughness}

# Apply to active object if any
obj = bpy.context.active_object
if obj and obj.type == 'MESH':
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

print(f"Created material: {mat.name}")
`.trim();
}
