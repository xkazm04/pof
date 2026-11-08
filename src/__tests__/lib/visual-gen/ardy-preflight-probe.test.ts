import { describe, expect, it } from 'vitest';
import { preflightArdy } from '@/lib/visual-gen/ardy-runner';
import type { ProcessOutcome } from '@/lib/visual-gen/local-process';

const go = async (o: ProcessOutcome) => {
  const r = await preflightArdy(
    { ardyRoot: 'C:/ardy', venvPython: 'py', scriptPath: 's' },
    { run: async () => o, fileExists: () => true, env: {} },
  );
  return { mc: r.checks.find((c) => c.name === 'motion_correction')!, cuda: r.checks.find((c) => c.name === 'cuda')! };
};

describe('preflightArdy does not diagnose a probe that never answered', () => {
  it('a probe that could not start is reported as that', async () => {
    const { mc, cuda } = await go({ stdout: '', code: null, spawnError: 'spawn py ENOENT' });
    expect(mc.ok).toBe(false);
    expect(mc.detail).toContain('spawn py ENOENT');
    expect(mc.detail).not.toContain('pip install');
    expect(cuda.detail).not.toContain('no CUDA device');
  });

  it('a probe killed by the timer is reported as that', async () => {
    const { mc } = await go({ stdout: '', code: null, timedOut: true });
    expect(mc.detail).toContain('timed out');
  });

  it('a torch import failure is not blamed on motion_correction', async () => {
    const { mc } = await go({ stdout: "ModuleNotFoundError: No module named 'torch'", code: 1 });
    expect(mc.detail).toContain("No module named 'torch'");
    expect(mc.detail).not.toContain('pip install');
  });
});
