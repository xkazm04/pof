// @vitest-environment node
/** A motionless clip measures 0 on every seam axis; the gate must not call it a loop. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { scoreLoopClosure, parseLoopMetrics, critiqueLoop, type LoopMetrics } from '@/lib/motion-gate/loopClosure';
import { pythonAvailable, scriptPath } from '@/__tests__/scripts/visualGenPyHarness';
import { drive, numpyAvailable, pyStr } from '@/__tests__/scripts/visualGenQualityDriver';

const FROZEN: LoopMetrics = {
  poseGapMm: 0, worstJointMm: 0, velJumpMm: 0, rootTravelMm: 0, frames: 90, motionRangeMm: 0,
};

describe('loop gate motion floor', () => {
  it('refuses a clip with identical frames', () => {
    const card = scoreLoopClosure(FROZEN);
    expect(card.verdict).not.toBe('pass');
    expect(card.verdict).toBe('fail');
    expect(card.reason).toContain('No motion');
  });

  it('still passes a moving clean cycle and an unmeasured amplitude', () => {
    const clean = { ...FROZEN, motionRangeMm: 180 };
    expect(scoreLoopClosure(clean).verdict).toBe('pass');
    const legacy: LoopMetrics = { ...FROZEN };
    delete legacy.motionRangeMm;
    expect(scoreLoopClosure(legacy).verdict).toBe('pass');
  });

  it('does not grade a frozen one-shot (n/a stays n/a)', () => {
    expect(scoreLoopClosure(FROZEN, 'oneshot').verdict).toBe('n/a');
  });

  it('parses the optional amplitude marker', () => {
    const base = 'POF_LOOP_POSE_GAP_MM=0\nPOF_LOOP_WORST_JOINT_MM=0\nPOF_LOOP_VEL_JUMP_MM=0\nPOF_LOOP_ROOT_TRAVEL_MM=0\nPOF_LOOP_FRAMES=9';
    expect(parseLoopMetrics(base).metrics?.motionRangeMm).toBeUndefined();
    expect(parseLoopMetrics(`${base}\nPOF_LOOP_MOTION_RANGE_MM=0.0000`).metrics?.motionRangeMm).toBe(0);
  });

  describe.skipIf(!pythonAvailable || !numpyAvailable)('through the extractor', () => {
    const run = (joints: string) => drive([
      'import numpy as np',
      `f = ${pyStr(join(mkdtempSync(join(tmpdir(), 'pof-loopmf-')), 'c.npz'))}`,
      `np.savez(f, posed_joints=${joints}, root_positions=np.zeros((9,3)))`,
      `run(${pyStr(scriptPath('ardy/pof_loop_closure.py'))}, [f])`,
    ].join('\n'));

    it('a frozen npz is not scored a clean loop', () => {
      const r = critiqueLoop(run('np.zeros((9,4,3))').stdout);
      expect(r.ok).toBe(true);
      expect(r.card?.verdict).toBe('fail');
    });

    it('a moving cycle that closes still passes', () => {
      const t = 'np.linspace(0, 2*np.pi, 9)';
      const r = critiqueLoop(run(`np.stack([np.sin(${t}), np.zeros(9), np.zeros(9)], -1)[:, None, :] * np.ones((9,4,3)) * 0.1`).stdout);
      expect(r.ok).toBe(true);
      expect(r.card?.verdict).not.toBe('fail');
    });
  });
});
