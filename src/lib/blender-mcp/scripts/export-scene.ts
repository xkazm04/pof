import { py } from '@/lib/blender-mcp/escape';
import { pyReceipt, pyStr } from '@/lib/blender-mcp/receipt';

/**
 * The export script ends in an `'export'` receipt carrying the path, printed only
 * once Blender's own exporter reported FINISHED. The UI keys off THAT receipt
 * (`readReceipt(result, 'export', { path })`), not off a bare transport OK: the
 * bridge may be on another machine, so PoF cannot stat the file, and a 200 from
 * `/api/blender-mcp/execute` only means the addon accepted the script.
 */
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

${pyReceipt('export', { path: pyStr(params.outputPath), format: pyStr(params.format) })}
`.trim();
}
