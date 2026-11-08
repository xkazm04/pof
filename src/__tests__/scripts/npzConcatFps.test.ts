// @vitest-environment node
/** The merged archive stores the frame rate the section starts were timed with. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { measureClip } from '@/lib/motion-gate/measureClip';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, numpyAvailable, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

function concat(fps: number) {
  const dir = mkdtempSync(join(tmpdir(), 'pof-concat-'));
  const a = join(dir, 'a.npz');
  const b = join(dir, 'b.npz');
  const out = join(dir, 'out.npz');
  const r = drive([
    'import numpy as np',
    'def clip(path):',
    '    np.savez(path, fps=np.asarray(' + fps + '), text=np.asarray("t"),',
    '        local_rot_mats=np.zeros((30,4,3,3)), global_rot_mats=np.zeros((30,4,3,3)),',
    '        posed_joints=np.zeros((30,4,3)), root_positions=np.zeros((30,3)),',
    '        smooth_root_pos=np.zeros((30,3)), foot_contacts=np.zeros((30,2)), global_root_heading=np.zeros((30,2)))',
    `clip(${pyStr(a)}); clip(${pyStr(b)})`,
    `run(${pyStr(scriptPath('ardy/pof_npz_concat.py'))}, [${pyStr(out)}, ${pyStr(a)}, ${pyStr(b)}])`,
  ].join('\n'));
  const starts = /POF_SECTION_STARTS (.*)/.exec(r.stdout)?.[1].split(' ').map(Number) ?? [];
  const clip = measureClip(readFileSync(out), { path: out });
  return { starts, fps: clip.ok ? clip.data.source.fps : null, stdout: r.stdout };
}

describe.skipIf(!pythonAvailable || !numpyAvailable)('pof_npz_concat fps', () => {
  it('keeps 29.97 instead of truncating it to 29', () => {
    const r = concat(29.97);
    expect(r.stdout).toContain('EXIT=0');
    expect(r.starts[1]).toBeCloseTo(30 / 29.97, 3);
    expect(r.fps).toBeCloseTo(29.97, 6);
  });

  it('an integer rate is unchanged', () => {
    const r = concat(30);
    expect(r.fps).toBe(30);
    expect(r.starts[1]).toBeCloseTo(1, 3);
  });
});
