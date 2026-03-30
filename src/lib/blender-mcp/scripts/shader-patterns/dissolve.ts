import { py } from '@/lib/blender-mcp/escape';

export function dissolveShaderScript(params: {
  materialName?: string;
  edgeColor?: [number, number, number];
  threshold?: number;
}): string {
  const name = params.materialName ?? 'Dissolve_Effect';
  const ec = params.edgeColor ?? [1.0, 0.3, 0.0];
  return `
import bpy

mat = bpy.data.materials.new(name="${py(name)}")
mat.use_nodes = True

# blend_method was removed in Blender 4.0; wrap for compatibility
try:
    mat.blend_method = 'CLIP'
except AttributeError:
    pass

nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
mix_shader = nodes.new('ShaderNodeMixShader')
principled = nodes.new('ShaderNodeBsdfPrincipled')
emission = nodes.new('ShaderNodeEmission')
emission.inputs["Color"].default_value = (${ec[0]}, ${ec[1]}, ${ec[2]}, 1.0)
emission.inputs["Strength"].default_value = 8.0

noise = nodes.new('ShaderNodeTexNoise')
noise.inputs["Scale"].default_value = 6.0
noise.inputs["Detail"].default_value = 4.0

ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = ${params.threshold ?? 0.4}
ramp.color_ramp.elements[1].position = ${(params.threshold ?? 0.4) + 0.05}

transparent = nodes.new('ShaderNodeBsdfTransparent')

links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
links.new(ramp.outputs["Color"], mix_shader.inputs["Fac"])
links.new(transparent.outputs["BSDF"], mix_shader.inputs[1])
links.new(principled.outputs["BSDF"], mix_shader.inputs[2])
links.new(mix_shader.outputs["Shader"], output.inputs["Surface"])

print(f"Created dissolve shader: ${py(name)}")
`.trim();
}
