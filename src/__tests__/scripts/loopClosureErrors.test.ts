// @vitest-environment node
/** The loop gate's parser trusts POF_LOOP_ERROR for the cause; every refusal must print one. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseLoopMetrics } from '@/lib/motion-gate/loopClosure';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, numpyAvailable, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

const SCRIPT = scriptPath('ardy/pof_loop_closure.py');
const tmp = () => mkdtempSync(join(tmpdir(), 'pof-loop-'));

function runArchive(arrays: string) {
  const file = join(tmp(), 'c.npz');
  return drive([
    'import numpy as np',
    `np.savez(${pyStr(file)}, ${arrays})`,
    `run(${pyStr(SCRIPT)}, [${pyStr(file)}])`,
  ].join('\n'));
}

describe.skipIf(!pythonAvailable || !numpyAvailable)('pof_loop_closure errors', () => {
  it('an unreadable archive prints POF_LOOP_ERROR', () => {
    const file = join(tmp(), 'bad.npz');
    writeFileSync(file, 'not a zip');
    const r = drive(`run(${pyStr(SCRIPT)}, [${pyStr(file)}])`);
    expect(parseLoopMetrics(r.stdout).ok).toBe(false);
    expect(r.stdout).toContain('POF_LOOP_ERROR=');
    expect(r.stdout).toContain('EXIT=2');
  });

  it('a wrong-rank root track prints POF_LOOP_ERROR', () => {
    const r = runArchive('posed_joints=np.zeros((4,2,3)), root_positions=np.zeros(4)');
    expect(r.stdout).toContain('POF_LOOP_ERROR=');
    expect(r.stdout).toContain('EXIT=2');
  });

  it('a measurable clip still reports its seam', () => {
    const r = runArchive('posed_joints=np.zeros((4,2,3)), root_positions=np.zeros((4,3))');
    expect(parseLoopMetrics(r.stdout).ok).toBe(true);
  });
});
