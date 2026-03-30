export interface CompositorSettings {
  bloom?: { intensity: number; threshold: number; radius: number };
  colorGrading?: { saturation: number; whiteBalance: number };
  vignette?: { intensity: number };
}

export function compositorStackScript(params: CompositorSettings): string {
  return `
import bpy

scene = bpy.context.scene
scene.use_nodes = True
nodes = scene.node_tree.nodes
links = scene.node_tree.links

# Clear existing compositor nodes (keep render layers + composite)
for node in list(nodes):
    if node.type not in ('R_LAYERS', 'COMPOSITE'):
        nodes.remove(node)

render_layer = nodes.get("Render Layers") or nodes.new('CompositorNodeRLayers')
composite = nodes.get("Composite") or nodes.new('CompositorNodeComposite')

last_output = render_layer.outputs["Image"]

${
  params.bloom
    ? `
# Bloom
glare = nodes.new('CompositorNodeGlare')
glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'
glare.threshold = ${params.bloom.threshold}
links.new(last_output, glare.inputs[0])
last_output = glare.outputs[0]
`
    : ''
}

${
  params.colorGrading
    ? `
# Color Grading
hsv = nodes.new('CompositorNodeHueSat')
hsv.inputs["Saturation"].default_value = ${params.colorGrading.saturation}
links.new(last_output, hsv.inputs["Image"])
last_output = hsv.outputs["Image"]
`
    : ''
}

${
  params.vignette
    ? `
# Vignette
lens = nodes.new('CompositorNodeLensdist')
lens.inputs["Distort"].default_value = -${params.vignette.intensity * 0.1}
links.new(last_output, lens.inputs["Image"])
last_output = lens.outputs["Image"]
`
    : ''
}

links.new(last_output, composite.inputs["Image"])

for i, node in enumerate(nodes):
    node.location = (i * 300, 0)

print("Compositor stack configured")
`.trim();
}
