// @vitest-environment node
/**
 * pof_mesh_finish.py over a fake bpy (`python -I`, no Blender).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath, tempTree } from '@/__tests__/scripts/visualGenPyHarness';

/** Drive main() with an exporter that either writes the file or quietly does nothing. */
function finish(exportWrites: boolean) {
  const dir = tempTree({ 'in.glb': 'x', 'out.glb': 'STALE' });
  const out = join(dir, 'out.glb').replace(/\\/g, '/');
  const body = [
    `ns = load(${JSON.stringify(scriptPath('pof_mesh_finish.py'))}, ["--input", ${JSON.stringify(join(dir, 'in.glb').replace(/\\/g, '/'))}, "--output", ${JSON.stringify(out)}])`,
    'obj = m.MagicMock(); obj.type = "MESH"',
    'bpy.context.scene.objects = [obj]',
    'def write(**k):',
    `    if ${exportWrites ? 'True' : 'False'}: open(${JSON.stringify(out)}, "w").write("NEW")`,
    'bpy.ops.export_scene.gltf.side_effect = write',
    'try:',
    '    ns["main"]()',
    'except SystemExit:',
    '    pass',
  ].join('\n');
  return { ...runPy(['-c', `${BLENDER_FAKES}${body}`]), out };
}

describe.skipIf(!pythonAvailable)('pof_mesh_finish.py', () => {
  it('control: a real export is reported DONE', () => {
    const r = finish(true);
    expect(r.stdout).toContain('POF_MESHFINISH_DONE=');
  });

  it('an exporter that wrote nothing cannot pass off the previous run\'s file', () => {
    const r = finish(false);
    expect(r.stdout).not.toContain('POF_MESHFINISH_DONE=');
    expect(r.stdout).toContain('POF_MESHFINISH_ERROR=export produced no file');
    expect(existsSync(r.out)).toBe(false);
  });
});
