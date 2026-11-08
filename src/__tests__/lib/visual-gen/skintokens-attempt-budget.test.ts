import { describe, expect, it } from 'vitest';
import { runSkintokens } from '@/lib/visual-gen/skintokens-runner';

const go = async (maxAttempts: number) => {
  let calls = 0;
  const run = async () => {
    calls++;
    if (calls > 20) throw new Error('unbounded crash loop');
    return { stdout: '', code: 139 };
  };
  const r = await runSkintokens(
    { meshPath: 'm.glb', outputPath: 'o.glb', binPath: 'b', modelDir: 'd', maxAttempts },
    { fileExists: () => true, now: () => 1, env: {}, run },
  );
  return { r, calls };
};

describe('runSkintokens: the crash-retry budget is a whole, finite number', () => {
  it('NaN runs the CLI once rather than zero times', async () => {
    const { r, calls } = await go(Number.NaN);
    expect(calls).toBe(1);
    expect(r.attempts).toBe(1);
  });

  it('Infinity runs once rather than without bound', async () => {
    expect((await go(Number.POSITIVE_INFINITY)).calls).toBe(1);
  });

  it('a fraction is floored', async () => {
    expect((await go(2.5)).calls).toBe(2);
  });
});
