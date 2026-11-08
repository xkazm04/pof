// @vitest-environment node
/** The FBX reviewer must play a clip at ITS rate, not a hardcoded 20 fps. */
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

function render(args: string[]) {
  const body = [
    'class P:',
    '    z = 1.0',
    'class W:',
    '    def __matmul__(self, v): return P()',
    'act = m.MagicMock(); act.frame_range = (0, 30)',
    'arm = m.MagicMock(); arm.type = "ARMATURE"; arm.matrix_world = W(); arm.animation_data.action = act',
    'pb = m.MagicMock(); pb.name = "pelvis"; pb.bone.length = 0.2; pb.head = P()',
    'class B(list):',
    '    def __getitem__(self, k): return pb if isinstance(k, str) else list.__getitem__(self, k)',
    'arm.pose.bones = B([pb])',
    'bpy.context.scene.objects = [arm]',
    `path = ${JSON.stringify(scriptPath('ardy/pof_fbx_render.py'))}`,
    `sys.argv = ["blender", "--"] + ${JSON.stringify(args)}`,
    'ns = {"__name__": "__main__", "__file__": path}',
    'try:',
    '    exec(compile(open(path, encoding="utf-8").read(), path, "exec"), ns); print("EXIT=0")',
    'except SystemExit as e:',
    '    print("EXIT=%s" % e.code)',
    'print("FPS=%s" % bpy.context.scene.render.fps)',
  ].join('\n');
  return runPy(['-c', `${BLENDER_FAKES}${body}`]);
}

describe.skipIf(!pythonAvailable)('pof_fbx_render fps', () => {
  it.each(['30', '24', '20'])('renders a %s fps clip at %s fps', (fps) => {
    const r = render(['in.fbx', 'out.mp4', fps]);
    expect(r.stdout).toContain('EXIT=0');
    expect(r.stdout).toContain(`FPS=${fps}`);
  });

  it('refuses a missing or unusable rate instead of guessing', () => {
    for (const args of [['in.fbx', 'out.mp4'], ['in.fbx', 'out.mp4', 'fast'], ['in.fbx', 'out.mp4', '0']]) {
      const r = render(args);
      expect(r.stdout).toContain('POF_RENDER_ERROR=');
      expect(r.stdout).toContain('EXIT=1');
    }
  });
});
