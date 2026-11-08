import { describe, it, expect } from 'vitest';
import { generateUntilAcceptable, DEFAULT_MAX_ATTEMPTS } from '@/lib/visual-gen/best-of-n';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

// Rolls are stubs (no provider); every mesh fails with a DIFFERENT primary reason so the
// reproducible-failure guard never stops the loop early — only the budget does.
const failing = (n: number): CritiqueResult => ({ ok: true, verdict: 'fail', score: 10, reasons: [`defect kind ${'x'.repeat(n)}`] } as CritiqueResult);

async function rollsSpent(maxAttempts: number) {
  let rolls = 0;
  const out = await generateUntilAcceptable(async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; }, {
    critic: async () => failing(rolls),
    maxAttempts,
  });
  return { rolls, reason: out.reason };
}

describe('generateUntilAcceptable — the attempt budget is a whole number of paid rolls', () => {
  it('an unreadable budget (NaN, e.g. maxAttempts:"abc" through the store clamp) buys exactly one roll', async () => {
    const r = await rollsSpent(Number.NaN);
    expect(r.rolls).toBe(1);
    expect(r.reason).not.toMatch(/NaN/);
  });

  it('an infinite budget is not an unbounded paid loop', async () => {
    const r = await rollsSpent(Number.POSITIVE_INFINITY);
    expect(r.rolls).toBe(1);
  });

  it('an absent budget still uses the default', async () => {
    let rolls = 0;
    await generateUntilAcceptable(async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; }, { critic: async () => failing(rolls) });
    expect(rolls).toBe(DEFAULT_MAX_ATTEMPTS);
  });

  it('a fractional budget is floored, and the reason names the budget actually used', async () => {
    const r = await rollsSpent(2.5);
    expect(r.rolls).toBe(2);
    expect(r.reason).toMatch(/in 2 attempts/);
  });
});
