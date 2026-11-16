// @vitest-environment node
/** The strip IS what the motion critic judges: a real clip only, endpoints kept. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { BLENDER_FAKES, pythonAvailable, runPy, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';

const SCRIPT = scriptPath('pof_anim_filmstrip.py');

function strip(opts: { meshes?: number; range?: [number, number] | null; n?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'pof-strip-'));
  const { meshes = 1, range = [0, 10], n = 3 } = opts;
  const body = [
    'class V:',
    '    def __init__(self, v=(0, 0, 0)): self.v = tuple(v)',
    '    x = property(lambda s: s.v[0]); y = property(lambda s: s.v[1]); z = property(lambda s: s.v[2])',
    '    def __getitem__(self, i): return self.v[i]',
    '    def __add__(self, o): return V(a + b for a, b in zip(self.v, o.v))',
    '    def __sub__(self, o): return V(a - b for a, b in zip(self.v, o.v))',
    '    def __mul__(self, k): return V(a * k for a in self.v)',
    '    def to_track_quat(self, *a): return m.MagicMock()',
    'mu.Vector = V',
    'class W:',
    '    def __matmul__(self, v): return v',
    'objs = []',
    `for _ in range(${meshes}):`,
    '    o = m.MagicMock(); o.type = "MESH"; o.bound_box = [(0, 0, 0), (1, 2, 1)]; o.matrix_world = W(); objs.append(o)',
    'bpy.context.scene.objects = objs',
    range ? `act = m.MagicMock(); act.frame_range = (${range[0]}, ${range[1]}); bpy.data.actions = [act]` : 'bpy.data.actions = []',
    'bpy.context.scene.frame_start = 1',
    `load(${JSON.stringify(SCRIPT)}, ["x.glb", ${JSON.stringify(dir)}, "${n}"], name="__main__")`,
  ].join('\n');
  return runPy(['-c', `${BLENDER_FAKES}${body}`]);
}

const frames = (out: string) => [...out.matchAll(/scene_frame=(\d+)/g)].map((x) => Number(x[1]));

describe.skipIf(!pythonAvailable)('pof_anim_filmstrip', () => {
  it('samples evenly and keeps the last pose', () => {
    expect(frames(strip({ range: [0, 10], n: 3 }).stdout)).toEqual([0, 5, 10]);
  });

  it.each([
    ['no mesh', { meshes: 0 }],
    ['no action', { range: null }],
    ['a one-frame action', { range: [4, 4] as [number, number] }],
  ])('%s renders nothing and says so', (_name, opts) => {
    const r = strip(opts);
    expect(r.stdout).toContain('POF_RENDER_ERROR=');
    expect(r.stdout).not.toContain('POF_RENDER_DONE=');
    expect(frames(r.stdout)).toEqual([]);
  });
});
