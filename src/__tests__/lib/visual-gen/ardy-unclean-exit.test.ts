import { describe, expect, it } from 'vitest';
import { runArdy } from '@/lib/visual-gen/ardy-runner';

const SPEC = { prompt: 'walk', outputPath: 'o', ardyRoot: 'C:/ardy', venvPython: 'py', scriptPath: 's' };
const SAVE = 'Saving the npz output to outputs\\o.npz\n';
const go = (o: { stdout: string; code: number | null; timedOut?: boolean }) =>
  runArdy(SPEC, { run: async () => o, fileExists: () => true, now: () => 1, env: {} });

describe('runArdy: the save line is printed BEFORE the write', () => {
  it('a non-zero exit after the save line is not a delivery', async () => {
    const r = await go({ stdout: SAVE, code: 1 });
    expect(r.ok).toBe(false);
    expect(r.npzPath).toBeUndefined();
    expect(r.error).toContain('exited with code 1');
  });

  it('a timeout kill after the save line is not a delivery', async () => {
    const r = await go({ stdout: SAVE, code: null, timedOut: true });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('timed out');
  });

  it('a clean exit still delivers', async () => {
    const r = await go({ stdout: SAVE, code: 0 });
    expect(r.ok).toBe(true);
    expect(r.npzPath).toBeTruthy();
  });
});
