import { describe, it, expect } from 'vitest';
import { combinedScore, generateBestOf, generateUntilAcceptable } from '@/lib/visual-gen/best-of-n';
import type { TriposrResult } from '@/lib/visual-gen/triposr-runner';
import type { CritiqueResult } from '@/lib/visual-gen/mesh-critique';

const R = (clipMax?: number): TriposrResult => ({ ok: true, meshPath: 'm.glb', clipMax, durationMs: 1 });

describe('combinedScore', () => {
  it('blends geometry score + CLIP fidelity', () => {
    expect(combinedScore(R(0.8), { ok: true, verdict: 'pass', score: 100, reasons: [] })).toBe(90); // 0.5*100 + 0.5*80
    expect(combinedScore(R(undefined), undefined)).toBe(0);
  });
});

describe('generateBestOf', () => {
  it('runs each variant, critiques it, and picks the highest combined score', async () => {
    const runner = async (spec: { foregroundRatio?: number; outputPath: string }): Promise<TriposrResult> =>
      ({ ok: true, meshPath: spec.outputPath, clipMax: spec.foregroundRatio === 0.9 ? 0.85 : 0.6, durationMs: 1 });
    const critic = async () => ({ ok: true, verdict: 'pass' as const, score: 100, reasons: [] });

    const res = await generateBestOf(
      { imagePath: 'i.png', outputPath: 'o.glb' },
      [{ label: 'fg0.7', foregroundRatio: 0.7 }, { label: 'fg0.9', foregroundRatio: 0.9 }],
      { runner, critic },
    );
    expect(res.candidates).toHaveLength(2);
    expect(res.best?.variant).toBe('fg0.9'); // higher clipMax → higher combined
    expect(res.candidates.every((c) => c.result.meshPath !== 'o.glb')).toBe(true); // distinct per-variant paths
  });

  it('ignores failed variants when picking the best', async () => {
    const runner = async (spec: { foregroundRatio?: number; outputPath: string }): Promise<TriposrResult> =>
      spec.foregroundRatio === 0.9 ? { ok: false, error: 'oom', durationMs: 1 } : { ok: true, meshPath: spec.outputPath, clipMax: 0.5, durationMs: 1 };
    const res = await generateBestOf(
      { imagePath: 'i.png', outputPath: 'o.glb' },
      [{ label: 'good', foregroundRatio: 0.7 }, { label: 'bad', foregroundRatio: 0.9 }],
      { runner, critic: async () => ({ ok: true, verdict: 'warn' as const, score: 70, reasons: [] }) },
    );
    expect(res.best?.variant).toBe('good');
  });
});

describe('generateUntilAcceptable (gate-driven retry for a stochastic generator)', () => {
  const card = (verdict: 'pass' | 'warn' | 'fail', score: number): CritiqueResult =>
    ({ ok: true, verdict, score, reasons: [] });

  it('stops re-rolling as soon as one clears the gate', async () => {
    const verdicts: Array<'fail' | 'pass'> = ['fail', 'pass', 'pass'];
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    const critic = async () => card(verdicts[rolls - 1], verdicts[rolls - 1] === 'pass' ? 100 : 5);

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 3 });

    expect(out.accepted).toBe(true);
    expect(out.best?.attempt).toBe(2);
    expect(rolls).toBe(2); // the third roll is never spent
  });

  it('reports honestly when the attempt budget is exhausted without a passing roll', async () => {
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    // Second roll is the least-bad; none clear the gate, and each fails DIFFERENTLY so
    // the reproducible-failure guard does not (correctly) cut the run short.
    const critic = async () => ({ ...card('fail', rolls === 2 ? 40 : 10),
      reasons: [['degenerate bbox', 'bad winding', 'empty mesh'][rolls - 1] ?? 'other'] });

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 3 });

    expect(out.accepted).toBe(false);
    expect(rolls).toBe(3);
    expect(out.attempts).toHaveLength(3);
    expect(out.best?.attempt).toBe(2); // best-so-far is still surfaced, just not accepted
    expect(out.reason).toMatch(/3 attempts/i);
  });

  it('never accepts a roll the generator failed to produce', async () => {
    const roll = async () => ({ ok: false, error: 'provider 500' } as { ok: boolean; meshPath?: string });
    let critiqued = 0;
    const critic = async () => { critiqued++; return card('pass', 100); };

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 2 });

    expect(out.accepted).toBe(false);
    expect(critiqued).toBe(0); // nothing to critique — no mesh was written
    expect(out.best).toBeUndefined();
  });
});

describe('generateUntilAcceptable — a reproducible failure is not a dice roll', () => {
  const card = (reasons: string[]): CritiqueResult =>
    ({ ok: true, verdict: 'fail' as const, score: 0, reasons });

  it('stops paying once the same failure repeats, even though the counts differ', async () => {
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    // Verbatim shape of the live Tripo failure: same defects every roll, different counts
    // each time (measured: 12/38 floaters/parts on one roll, 33/56 on the next).
    const critic = async () =>
      card([`${rolls * 11} floater fragments (${rolls * 1000} faces of specks)`,
            `${rolls * 18} substantial disconnected parts (above the 6 budget for this class)`,
            'not watertight (open boundary / holes)']);

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 5 });

    expect(rolls).toBe(2); // one re-roll to learn it reproduces, then stop
    expect(out.accepted).toBe(false);
    expect(out.reason).toMatch(/same|repeat|reproduc/i);
  });

  it('keeps re-rolling while the failure keeps changing', async () => {
    let rolls = 0;
    const roll = async () => { rolls++; return { ok: true, meshPath: `m${rolls}.glb` }; };
    const critic = async () => card([['degenerate bounding box', 'inconsistent face winding', 'empty mesh'][rolls - 1] ?? 'other']);

    const out = await generateUntilAcceptable(roll, { critic, maxAttempts: 3 });

    expect(rolls).toBe(3); // genuinely varying failures are worth the re-roll
    expect(out.accepted).toBe(false);
  });
});
