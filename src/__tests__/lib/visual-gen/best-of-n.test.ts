import { describe, it, expect } from 'vitest';
import { combinedScore, generateBestOf } from '@/lib/visual-gen/best-of-n';
import type { TriposrResult } from '@/lib/visual-gen/triposr-runner';

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
