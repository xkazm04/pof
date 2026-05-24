import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSafeMontage } from '@/components/modules/core-engine/sub_animation/combos-montages/useSafeMontage';
import { SCRUBBER_TOTAL_FRAMES, type MontageEntry, type NotifyLane } from '@/components/modules/core-engine/sub_animation/_shared/data';

function montage(id: string, totalFrames: number): MontageEntry {
  return { id, name: id, category: 'Attack', totalFrames, fps: 30, memorySizeMB: 1, hasRootMotion: false, blendInTime: 0.1 };
}

const LANES: NotifyLane[] = [
  { name: 'A', color: 'var(--text)', startFrame: 0, endFrame: SCRUBBER_TOTAL_FRAMES / 2 },
];

describe('useSafeMontage', () => {
  it('returns an empty state (no crash) when the montage list is empty', () => {
    const { result } = renderHook(() => useSafeMontage([], LANES, 'whatever'));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.selectedMontage).toBeNull();
    expect(result.current.safeTotalFrames).toBe(1);
    expect(result.current.scaledLanes).toEqual([]);
    expect(result.current.framePercent(10)).toBe(0);
  });

  it('clamps a 0-frame montage to avoid divide-by-zero NaN%', () => {
    const { result } = renderHook(() => useSafeMontage([montage('z', 0)], LANES, 'z'));
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.safeTotalFrames).toBe(1);
    // Every framePercent output must be a finite, bounded number — never NaN.
    for (const frame of [0, 1, 5, -3, Number.NaN, Infinity]) {
      const pct = result.current.framePercent(frame);
      expect(Number.isFinite(pct)).toBe(true);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it('treats negative / non-finite frame counts as 1', () => {
    expect(renderHook(() => useSafeMontage([montage('n', -10)], LANES, 'n')).result.current.safeTotalFrames).toBe(1);
    expect(renderHook(() => useSafeMontage([montage('x', Number.NaN)], LANES, 'x')).result.current.safeTotalFrames).toBe(1);
  });

  it('computes percentages and scales lanes for a normal montage', () => {
    const { result } = renderHook(() => useSafeMontage([montage('ok', 60)], LANES, 'ok'));
    expect(result.current.safeTotalFrames).toBe(60);
    expect(result.current.framePercent(30)).toBe(50);
    // clamps out-of-range frames to [0, 100]
    expect(result.current.framePercent(120)).toBe(100);
    expect(result.current.framePercent(-5)).toBe(0);
    // lane endFrame (15 of base 30) scales to half of 60 = 30
    expect(result.current.scaledLanes[0].endFrame).toBe(30);
  });

  it('falls back to the first montage when the selected id is missing', () => {
    const { result } = renderHook(() => useSafeMontage([montage('first', 40), montage('second', 80)], LANES, 'nope'));
    expect(result.current.selectedMontage?.id).toBe('first');
    expect(result.current.safeTotalFrames).toBe(40);
  });
});
