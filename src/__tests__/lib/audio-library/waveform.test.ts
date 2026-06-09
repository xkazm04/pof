import { describe, it, expect } from 'vitest';
import { waveformBars } from '@/lib/audio-library/waveform';

describe('waveformBars', () => {
  it('is deterministic for the same seed', () => {
    expect(waveformBars('abc')).toEqual(waveformBars('abc'));
  });

  it('differs across seeds', () => {
    expect(waveformBars('abc')).not.toEqual(waveformBars('xyz'));
  });

  it('returns the requested count with values in [0.08, 1]', () => {
    const bars = waveformBars('seed', 24);
    expect(bars).toHaveLength(24);
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(0.08);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it('handles empty seed and degenerate counts without crashing', () => {
    expect(waveformBars('', 0)).toHaveLength(1);
    expect(waveformBars('x', 1)).toHaveLength(1);
  });
});
