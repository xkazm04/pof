import { py } from '@/lib/blender-mcp/escape';

/**
 * The token the export script prints when Blender's own exporter reported
 * FINISHED. The UI keys off THIS, not off a bare transport OK: the bridge may
 * be on another machine, so PoF cannot stat the file, and a 200 from
 * `/api/blender-mcp/execute` only means the addon accepted the script.
 */
export const EXPORT_OK_MARKER = 'POF_EXPORT_FINISHED=';

export function exportSceneScript(params: {
  outputPath: string;
  format: 'fbx' | 'gltf';
}): string {
  const path = py(params.outputPath);
  const call =
    params.format === 'fbx'
      ? `bpy.ops.export_scene.fbx(filepath=r"${path}", use_selection=False)`
      : `bpy.ops.export_scene.gltf(filepath=r"${path}", export_format="GLB")`;
  // The operator's own return set is the strongest evidence available from
  // here. Anything but FINISHED raises, so it can never reach the UI as a pass.
  return `
import bpy

status = ${call}
if 'FINISHED' not in status:
    raise RuntimeError("Blender's exporter returned " + str(status) + " instead of FINISHED")

print("${EXPORT_OK_MARKER}${path}")
`.trim();
}
