import { describe, it, expect } from 'vitest';
import { clampDodgeParams, safeDur } from '@/components/modules/core-engine/sub_combat/_shared/dodge-math';
import { DEFAULT_PARAMS, type DodgeParams } from '@/components/modules/core-engine/sub_combat/_shared/dodge-types';

// clampDodgeParams enforces its invariants for every duration, not only sane ones:
// it routes the duration through safeDur, the guard written for exactly this
// (scan-sweep night 2026-11-08, combat-metrics).

const WINDOW_KEYS = ['iFrameStart', 'iFrameDuration', 'cancelWindowStart', 'cancelWindowEnd'] as const;

function invariantsHold(p: DodgeParams): string[] {
  const broken: string[] = [];
  for (const k of WINDOW_KEYS) if (!Number.isFinite(p[k]) || p[k] < 0) broken.push(`${k}=${p[k]}`);
  if (!(p.dodgeDuration >= 0.01)) broken.push(`dodgeDuration=${p.dodgeDuration}`);
  if (p.iFrameStart + p.iFrameDuration > p.dodgeDuration + 1e-9) broken.push('i-frames past movement');
  if (p.cancelWindowEnd < p.cancelWindowStart) broken.push('negative cancel window');
  if (p.cancelWindowEnd > p.dodgeDuration + 1e-9) broken.push('cancel past duration');
  return broken;
}

describe('clampDodgeParams', () => {
  it('leaves already-valid params unchanged', () => {
    expect(clampDodgeParams(DEFAULT_PARAMS)).toEqual(DEFAULT_PARAMS);
  });

  it('clamps i-frames and the cancel window into a short dodge', () => {
    const p = clampDodgeParams({ ...DEFAULT_PARAMS, dodgeDuration: 0.1, iFrameDuration: 1.0, cancelWindowEnd: 2.0 });
    expect(invariantsHold(p)).toEqual([]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('holds every invariant for dodgeDuration=%s', (d) => {
    const p = clampDodgeParams({ ...DEFAULT_PARAMS, dodgeDuration: d });
    expect(invariantsHold(p)).toEqual([]);
    expect(p.dodgeDuration).toBe(safeDur(d));
  });
});
