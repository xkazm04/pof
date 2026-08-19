import { py } from '@/lib/blender-mcp/escape';

/** A texture source Blender can actually open: a local file path or an http(s) URL. */
export interface MaterialTextureSources {
  albedo?: string;
  normal?: string;
  metallic?: string;
  roughness?: string;
  ao?: string;
}

export interface CreateMaterialParams {
  name: string;
  baseColor: [number, number, number];
  metallic: number;
  roughness: number;
  /** Normal Map node strength. Only wired when a `normal` texture is supplied. */
  normalStrength: number;
  /** Multiply factor for the AO map over base colour. Only wired when `ao` is supplied. */
  aoStrength: number;
  textures?: MaterialTextureSources;
}

/**
 * Helpers the generated script needs before it can wire anything.
 *
 * `_load_image` accepts either a filesystem path or an http(s) URL — Blender's
 * `bpy.data.images.load` cannot fetch over the network, so a URL is downloaded
 * to a temp file first. That is what lets a map generated in the Advanced tab
 * (a Scenario/Leonardo URL) actually reach Blender instead of being dropped.
 *
 * `_multiply_node` spans the 3.x/4.x node rename: `ShaderNodeMixRGB` became
 * `ShaderNodeMix` (whose RGBA A/B sockets are `inputs[6]`/`inputs[7]` and whose
 * result is `outputs[2]`, since the node carries one socket set per data type).
 */
const HELPERS = `
def _load_image(src):
    if src.startswith("http://") or src.startswith("https://"):
        import os, tempfile, urllib.parse, urllib.request
        suffix = os.path.splitext(urllib.parse.urlparse(src).path)[1] or ".png"
        fd, tmp = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        urllib.request.urlretrieve(src, tmp)
        return bpy.data.images.load(tmp)
    return bpy.data.images.load(src, check_existing=True)


def _tex_node(nodes, src, colorspace, y):
    node = nodes.new("ShaderNodeTexImage")
    node.location = (-800, y)
    node.image = _load_image(src)
    try:
        node.image.colorspace_settings.name = colorspace
    except Exception:
        pass
    return node


def _multiply_node(nodes, factor):
    try:
        node = nodes.new("ShaderNodeMix")
        node.data_type = 'RGBA'
        node.blend_type = 'MULTIPLY'
        node.inputs['Factor'].default_value = factor
        return node, node.inputs[6], node.inputs[7], node.outputs[2]
    except RuntimeError:
        node = nodes.new("ShaderNodeMixRGB")
        node.blend_type = 'MULTIPLY'
        node.inputs['Fac'].default_value = factor
        return node, node.inputs['Color1'], node.inputs['Color2'], node.outputs['Color']
`.trim();

/**
 * Build the Blender Python that recreates the lab's material.
 *
 * Every parameter the caller passes is wired into the node graph — the scalars
 * onto the Principled BSDF, each supplied texture onto its own image node, the
 * normal map through a Normal Map node carrying `normalStrength`, and the AO map
 * as a MULTIPLY over base colour with `aoStrength` as the factor. `normalStrength`
 * and `aoStrength` are omitted when their map is absent because Blender has no
 * place to put them (a Normal Map node with no image is flat, and there is no AO
 * input on the BSDF) — the caller reports that rather than implying they landed.
 */
export function createMaterialScript(params: CreateMaterialParams): string {
  const tex = params.textures ?? {};
  const body: string[] = [];

  body.push(`mat = bpy.data.materials.new(name="${py(params.name)}")`);
  body.push('mat.use_nodes = True');
  body.push('nodes = mat.node_tree.nodes');
  body.push('links = mat.node_tree.links');
  body.push('bsdf = nodes["Principled BSDF"]');
  body.push(
    `bsdf.inputs["Base Color"].default_value = (${params.baseColor[0]}, ${params.baseColor[1]}, ${params.baseColor[2]}, 1.0)`,
  );
  body.push(`bsdf.inputs["Metallic"].default_value = ${params.metallic}`);
  body.push(`bsdf.inputs["Roughness"].default_value = ${params.roughness}`);
  body.push('applied = ["Base Color", "Metallic", "Roughness"]');

  // Base colour chain: albedo image (if any) optionally multiplied by the AO map.
  if (tex.albedo) {
    body.push(`albedo_tex = _tex_node(nodes, "${py(tex.albedo)}", "sRGB", 300)`);
    body.push('applied.append("Albedo map")');
  }
  if (tex.ao) {
    body.push(`ao_tex = _tex_node(nodes, "${py(tex.ao)}", "Non-Color", -300)`);
    body.push(`ao_mix, ao_a, ao_b, ao_out = _multiply_node(nodes, ${params.aoStrength})`);
    body.push("ao_mix.location = (-400, 200)");
    if (tex.albedo) {
      body.push('links.new(albedo_tex.outputs["Color"], ao_a)');
    } else {
      body.push(
        `ao_a.default_value = (${params.baseColor[0]}, ${params.baseColor[1]}, ${params.baseColor[2]}, 1.0)`,
      );
    }
    body.push('links.new(ao_tex.outputs["Color"], ao_b)');
    body.push('links.new(ao_out, bsdf.inputs["Base Color"])');
    body.push(`applied.append("AO map x AO Strength ${params.aoStrength}")`);
  } else if (tex.albedo) {
    body.push('links.new(albedo_tex.outputs["Color"], bsdf.inputs["Base Color"])');
  }

  if (tex.metallic) {
    body.push(`metallic_tex = _tex_node(nodes, "${py(tex.metallic)}", "Non-Color", 0)`);
    body.push('links.new(metallic_tex.outputs["Color"], bsdf.inputs["Metallic"])');
    body.push('applied.append("Metallic map")');
  }
  if (tex.roughness) {
    body.push(`roughness_tex = _tex_node(nodes, "${py(tex.roughness)}", "Non-Color", -150)`);
    body.push('links.new(roughness_tex.outputs["Color"], bsdf.inputs["Roughness"])');
    body.push('applied.append("Roughness map")');
  }
  if (tex.normal) {
    body.push(`normal_tex = _tex_node(nodes, "${py(tex.normal)}", "Non-Color", 150)`);
    body.push('normal_map = nodes.new("ShaderNodeNormalMap")');
    body.push('normal_map.location = (-400, 150)');
    body.push(`normal_map.inputs["Strength"].default_value = ${params.normalStrength}`);
    body.push('links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])');
    body.push('links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])');
    body.push(`applied.append("Normal map x Normal Strength ${params.normalStrength}")`);
  }

  return `
import bpy

${HELPERS}

${body.join('\n')}

# Apply to active object if any
obj = bpy.context.active_object
if obj and obj.type == 'MESH':
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

print(f"Created material: {mat.name} with " + ", ".join(applied))
`.trim();
}
