import { describe, it, expect } from 'vitest';
import { heatmapScale, lerpHexColor, HEATMAP_STEP_1 } from '@/lib/chart-colors';

// Math.max(0, Math.min(1, NaN)) is NaN, so the clamp did not contain a bad ratio.
describe('colour ramps survive a NaN input', () => {
  it('heatmapScale reads NaN as the lowest stop instead of throwing', () => {
    expect(heatmapScale(Number.NaN)).toBe(HEATMAP_STEP_1);
  });

  it('lerpHexColor reads NaN as the start colour instead of #NaNNaNNaN', () => {
    expect(lerpHexColor('#102030', '#ffffff', Number.NaN)).toBe('#102030');
  });
});
