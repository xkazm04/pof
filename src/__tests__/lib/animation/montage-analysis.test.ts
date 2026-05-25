import { describe, it, expect } from 'vitest';
import { montageMetrics, lintMontage, asMontage, type MontageLike } from '@/lib/animation/montage-analysis';

function montage(over: Partial<MontageLike> = {}): MontageLike {
  return { id: 'atk-combo1', name: 'AM_Combo1', category: 'Attack', totalFrames: 30, fps: 30, memorySizeMB: 1.2, hasRootMotion: true, blendInTime: 0.05, ...over };
}

const peers: MontageLike[] = [
  montage(),
  montage({ id: 'b', memorySizeMB: 1.3 }),
  montage({ id: 'c', memorySizeMB: 1.5 }),
];

describe('montageMetrics', () => {
  it('computes duration in seconds from frames and fps', () => {
    expect(montageMetrics(montage({ totalFrames: 60, fps: 30 })).durationSec).toBeCloseTo(2, 3);
  });
  it('avoids divide-by-zero on zero fps', () => {
    expect(montageMetrics(montage({ fps: 0 })).durationSec).toBe(0);
  });
});

describe('lintMontage', () => {
  it('passes a normal montage with clustered peers', () => {
    const findings = lintMontage(montage(), peers);
    expect(findings.every((f) => f.severity === 'ok')).toBe(true);
  });

  it('warns on a memory outlier vs same-category peers', () => {
    const findings = lintMontage(montage({ id: 'fat', memorySizeMB: 12 }), peers);
    expect(findings.some((f) => f.severity === 'warn' && /memory/i.test(f.message))).toBe(true);
  });

  it('warns when an attack montage has no root motion', () => {
    const findings = lintMontage(montage({ id: 'norm', hasRootMotion: false }), peers);
    expect(findings.some((f) => f.severity === 'warn' && /root motion/i.test(f.message))).toBe(true);
  });

  it('warns about a long blend-in time', () => {
    const findings = lintMontage(montage({ id: 'slow', blendInTime: 0.8 }), peers);
    expect(findings.some((f) => f.severity === 'warn' && /blend/i.test(f.message))).toBe(true);
  });
});

describe('asMontage', () => {
  it('parses a montage-shaped object', () => {
    expect(asMontage(montage())).not.toBeNull();
  });
  it('returns null for non-montage data', () => {
    expect(asMontage({ id: 'x' })).toBeNull();
    expect(asMontage(null)).toBeNull();
  });
});
