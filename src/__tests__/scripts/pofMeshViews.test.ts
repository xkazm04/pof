// @vitest-environment node
/**
 * scripts/visual-gen/pof_mesh_views.py helpers, loaded with `python -I` over a fake bpy.
 * The blank-render defect was first measured in real Blender 4.2 (see the commit).
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

const SCRIPT = scriptPath('pof_mesh_views.py');
const driver = (body: string) => runPy(['-c', `${BLENDER_FAKES}ns = load(${JSON.stringify(SCRIPT)}, [])\n${body}`]);

describe.skipIf(!pythonAvailable)('pof_mesh_views.py', () => {
  it.each([0.03, 0.1, 1, 150])('the camera range encloses a %s m asset', (size) => {
    const r = driver([
      `size = ${size}; dist = size * 1.9; reach = size * 3 ** 0.5 / 2`,
      'near, far = ns["camera_clip"](size, dist)',
      'print(0 < near < dist - reach, far > dist + reach)',
    ].join('\n'));
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('True True');
  });

  it('the palette reads pixels in bulk and keeps its colours', () => {
    const r = driver([
      'vals = [0.5, 0.2, 0.1, 1.0] * 6 + [0.9, 0.9, 0.0, 1.0] * 3 + [0.0, 0.0, 0.0, 0.0] * 7',
      'used = []',
      'class P:',
      '    def __len__(self): return len(vals)',
      '    def __getitem__(self, i):',
      '        used.append("slice")',
      '        return vals[i]',
      '    def foreach_get(self, buf):',
      '        used.append("bulk")',
      '        buf[:] = vals',
      'img = m.MagicMock(); img.pixels = P()',
      'bpy.data.images.load.return_value = img',
      'print(",".join(ns["palette_of"]("x.png")), used)',
    ].join('\n'));
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain("#b77858,#f7f708 ['bulk']"); // colours pinned from the pre-change output
  });

  it('the render camera actually uses that range', () => {
    expect(readFileSync(SCRIPT, 'utf8')).toContain('cam_data.clip_start, cam_data.clip_end = camera_clip(size, dist)');
  });
});
