// @vitest-environment node
/** The FK round-trip is the gate that refuses a scrambled BVH: NaN must not clear it. */
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, numpyAvailable, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

const SCRIPT = scriptPath('ardy/pof_npz_to_bvh.py');

function convert(posed: string) {
  const dir = mkdtempSync(join(tmpdir(), 'pof-bvh-'));
  const out = join(dir, 'o.bvh');
  const npz = join(dir, 'c.npz');
  const r = drive([
    'import numpy as np',
    `np.savez(${pyStr(npz)}, local_rot_mats=np.tile(np.eye(3), (2,1,1,1)), root_positions=np.zeros((2,3)), posed_joints=np.zeros((2,1,3)), fps=np.asarray(30))`,
    'class T:',
    '    def float(self): return self',
    'fake("torch", from_numpy=lambda a: T())',
    'fake("scipy"); fake("scipy.spatial")',
    'R = m.MagicMock(); R.from_matrix.return_value.as_euler.return_value = np.zeros((2,3))',
    'fake("scipy.spatial.transform", Rotation=R)',
    'skel = m.MagicMock(); skel.bone_order_names_with_parents = [("Hips", None)]',
    'skel.neutral_joints.numpy.return_value = np.zeros((1,3)); skel.root_idx = 0',
    'fake("ardy"); fake("ardy.skeleton"); fake("ardy.skeleton.registry", build_skeleton=lambda n: skel)',
    'posed = m.MagicMock()',
    `posed.numpy.return_value = ${posed}`,
    'fake("ardy.skeleton.kinematics", fk=lambda *a, **k: (None, posed, None))',
    `run(${pyStr(SCRIPT)}, [${pyStr(npz)}, ${pyStr(out)}])`,
  ].join('\n'));
  return { r, wrote: existsSync(out) };
}

describe.skipIf(!pythonAvailable || !numpyAvailable)('pof_npz_to_bvh FK gate', () => {
  it('refuses a clip whose FK reproduces NaN', () => {
    const { r, wrote } = convert('np.full((2,1,3), np.nan)');
    expect(r.stdout).toContain('EXIT=1');
    expect(r.stdout).not.toContain('FK round-trip ok');
    expect(wrote).toBe(false);
  });

  it('still writes a clip that reproduces its joints', () => {
    const { r, wrote } = convert('np.zeros((2,1,3))');
    expect(r.stdout).toContain('FK round-trip ok');
    expect(wrote).toBe(true);
  });
});
