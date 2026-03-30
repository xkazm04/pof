import { py } from '@/lib/blender-mcp/escape';

export function exportSceneScript(params: {
  outputPath: string;
  format: 'fbx' | 'gltf';
}): string {
  if (params.format === 'fbx') {
    return `
import bpy
bpy.ops.export_scene.fbx(filepath=r"${py(params.outputPath)}", use_selection=False)
print(f"Exported scene to: ${py(params.outputPath)}")
`.trim();
  }
  return `
import bpy
bpy.ops.export_scene.gltf(filepath=r"${py(params.outputPath)}", export_format="GLB")
print(f"Exported scene to: ${py(params.outputPath)}")
`.trim();
}
