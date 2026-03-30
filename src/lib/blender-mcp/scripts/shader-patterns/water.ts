import { py } from '@/lib/blender-mcp/escape';

export function waterShaderScript(params: {
  materialName?: string;
  waveScale?: number;
}): string {
  const name = params.materialName ?? 'Water_Surface';
  return `
import bpy

mat = bpy.data.materials.new(name="${py(name)}")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
glass = nodes.new('ShaderNodeBsdfGlass')
glass.inputs["Roughness"].default_value = 0.05
glass.inputs["IOR"].default_value = 1.333

wave1 = nodes.new('ShaderNodeTexWave')
wave1.wave_type = 'RINGS'
wave1.inputs["Scale"].default_value = ${params.waveScale ?? 8.0}

wave2 = nodes.new('ShaderNodeTexWave')
wave2.wave_type = 'BANDS'
wave2.inputs["Scale"].default_value = ${(params.waveScale ?? 8.0) * 1.5}

mix = nodes.new('ShaderNodeMixRGB')
mix.blend_type = 'ADD'

bump = nodes.new('ShaderNodeBump')
bump.inputs["Strength"].default_value = 0.3

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.0, 0.1, 0.3, 1.0)
ramp.color_ramp.elements[1].color = (0.0, 0.4, 0.6, 1.0)

links.new(wave1.outputs["Fac"], mix.inputs[1])
links.new(wave2.outputs["Fac"], mix.inputs[2])
links.new(mix.outputs[0], bump.inputs["Height"])
links.new(mix.outputs[0], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], glass.inputs["Color"])
links.new(bump.outputs["Normal"], glass.inputs["Normal"])
links.new(glass.outputs["BSDF"], output.inputs["Surface"])

for i, node in enumerate(nodes):
    node.location = (i * 250 - 600, 0)

print(f"Created water shader: ${py(name)}")
`.trim();
}
