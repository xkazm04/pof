// @vitest-environment node
/**
 * pof_mesh_seethrough.py over a fake bpy (`python -I`, no Blender).
 */
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath, tempTree } from '@/__tests__/scripts/visualGenPyHarness';

/** Fake armature holding these bones; the script stops at the guard or later. */
function seethrough(bones: string[], extra: string[] = []) {
  const dir = tempTree({ 'keep.txt': '' }).replace(/\\/g, '/');
  const body = [
    'arm = m.MagicMock(); arm.type = "ARMATURE"',
    `arm.pose.bones = {b: m.MagicMock() for b in ${JSON.stringify(bones)}}`,
    'mesh = m.MagicMock(); mesh.type = "MESH"',
    'bpy.data.objects = [arm, mesh]',
    'bpy.ops.render.render.side_effect = RuntimeError("reached render")',
    'try:',
    `    load(${JSON.stringify(scriptPath('pof_mesh_seethrough.py'))}, [${JSON.stringify(dir)}, ${extra.map((e) => JSON.stringify(e)).join(', ')}], "__main__")`,
    'except Exception as e:',
    '    print("DRIVER_STOP", type(e).__name__, e)',
  ].join('\n');
  return runPy(['-c', `${BLENDER_FAKES}${body}`]);
}

const UE = ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'];

describe.skipIf(!pythonAvailable)('pof_mesh_seethrough.py', () => {
  it('refuses a skeleton the pose sweep cannot move, instead of sweeping nothing', () => {
    const r = seethrough(['mixamorig:Hips', 'mixamorig:Spine']);
    expect(r.stdout).toContain('POF_SEETHROUGH_ERROR=');
    expect(r.stdout).not.toContain('POF_SEETHROUGH_VIEWS=');
  });

  it('control: a UE-mannequin skeleton passes the guard', () => {
    expect(seethrough(UE).stdout).not.toContain('POF_SEETHROUGH_ERROR=');
  });

  it('--quick renders only the rest pose, so it does not need the bones', () => {
    expect(seethrough(['mixamorig:Hips'], ['--quick']).stdout).not.toContain('POF_SEETHROUGH_ERROR=');
  });
});
