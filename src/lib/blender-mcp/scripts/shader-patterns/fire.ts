import { py } from '@/lib/blender-mcp/escape';

export function fireShaderScript(params: {
  materialName?: string;
  intensity?: number;
}): string {
  const name = params.materialName ?? 'Fire_Embers';
  return `
import bpy

mat = bpy.data.materials.new(name="${py(name)}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
emission.inputs["Strength"].default_value = ${params.intensity ?? 5.0}

noise = nodes.new('ShaderNodeTexNoise')
noise.inputs["Scale"].default_value = 4.0
noise.inputs["Detail"].default_value = 8.0

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.3
ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
ramp.color_ramp.elements[1].color = (1.0, 0.15, 0.0, 1.0)
el = ramp.color_ramp.elements.new(0.7)
el.color = (1.0, 0.8, 0.0, 1.0)

mapping = nodes.new('ShaderNodeMapping')
mapping.inputs["Location"].default_value[2] = 1.0

coord = nodes.new('ShaderNodeTexCoord')

links.new(coord.outputs["Object"], mapping.inputs["Vector"])
links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], emission.inputs["Color"])
links.new(emission.outputs["Emission"], output.inputs["Surface"])

for i, node in enumerate(nodes):
    node.location = (i * 250 - 600, 0)

print(f"Created fire shader: ${py(name)}")
`.trim();
}
