// @vitest-environment node
/** A render of an action-less armature must fail loudly: marker + non-zero exit, and the
 *  documented invocation must carry --python-exit-code (Blender exits 0 on exceptions). */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

const RENDERERS = [
  { file: 'ardy/pof_bvh_render.py', input: 'in.bvh', setup: 'bpy.context.object = arm' },
  { file: 'ardy/pof_fbx_render.py', input: 'in.fbx', setup: 'o = m.MagicMock(); o.type = "ARMATURE"; o.animation_data = None; bpy.context.scene.objects = [o]' },
];

function render(file: string, input: string, setup: string) {
  const body = [
    'arm = m.MagicMock(); arm.animation_data = None',
    setup,
    `path = ${JSON.stringify(scriptPath(file))}`,
    `sys.argv = ["blender", "--", ${JSON.stringify(input)}, "out.mp4"]`,
    'ns = {"__name__": "__main__", "__file__": path}',
    'try:',
    '    exec(compile(open(path, encoding="utf-8").read(), path, "exec"), ns); print("EXIT=0")',
    'except SystemExit as e:',
    '    print("EXIT=%s" % e.code)',
    'except Exception as e:',
    '    print("EXC=" + type(e).__name__)',
  ].join('\n');
  return runPy(['-c', `${BLENDER_FAKES}${body}`]);
}

describe.skipIf(!pythonAvailable).each(RENDERERS)('$file', ({ file, input, setup }) => {
  it('an armature with no action prints POF_RENDER_ERROR and exits non-zero', () => {
    const r = render(file, input, setup);
    expect(r.stdout).toContain('POF_RENDER_ERROR=');
    expect(r.stdout).toContain('EXIT=1');
    expect(r.stdout).not.toContain('POF_RENDER_OK');
  });

  it('documents --python-exit-code in its usage line', () => {
    expect(readFileSync(scriptPath(file), 'utf-8')).toContain('--python-exit-code 1');
  });
});
