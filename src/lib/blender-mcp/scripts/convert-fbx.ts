import { py } from '@/lib/blender-mcp/escape';

export function convertFbxScript(params: {
  inputPath: string;
  outputPath: string;
  dracoCompression?: boolean;
}): string {
  return `
import bpy
import os

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
bpy.ops.import_scene.fbx(filepath=r"${py(params.inputPath)}")

# Export as glTF
export_settings = {
    "filepath": r"${py(params.outputPath)}",
    "export_format": "GLB",
    "export_draco_mesh_compression_enable": ${params.dracoCompression !== false ? 'True' : 'False'},
}
bpy.ops.export_scene.gltf(**export_settings)

print(f"Converted: {r'${py(params.inputPath)}'} -> {r'${py(params.outputPath)}'}")
`.trim();
}
