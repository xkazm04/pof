import { py } from '@/lib/blender-mcp/escape';

export function applyTextureScript(params: {
  materialName: string;
  textureSlot: 'base_color' | 'normal' | 'metallic' | 'roughness' | 'ao';
  texturePath: string;
}): string {
  const inputMap: Record<string, string> = {
    base_color: 'Base Color',
    normal: 'Normal',
    metallic: 'Metallic',
    roughness: 'Roughness',
    ao: 'Ambient Occlusion',
  };
  const inputName = inputMap[params.textureSlot] ?? 'Base Color';
  const isNonColor = params.textureSlot !== 'base_color';

  return `
import bpy

mat = bpy.data.materials.get("${py(params.materialName)}")
if not mat:
    raise ValueError("Material '${py(params.materialName)}' not found")

nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

tex_node = nodes.new('ShaderNodeTexImage')
tex_node.image = bpy.data.images.load(r"${py(params.texturePath)}")
${isNonColor ? 'tex_node.image.colorspace_settings.name = "Non-Color"' : ''}

links.new(tex_node.outputs["Color"], bsdf.inputs["${inputName}"])

print(f"Applied texture to {mat.name} -> ${inputName}")
`.trim();
}
