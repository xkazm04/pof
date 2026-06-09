import { describe, it, expect } from 'vitest';
import {
  lerpHexColor,
  heatmapScale,
  qualityCellColor,
  qualityAccentColor,
  QUALITY_HEATMAP_LOW,
  QUALITY_HEATMAP_MID,
  QUALITY_HEATMAP_HIGH,
  HEATMAP_STEP_1,
  HEATMAP_STEP_5,
  STATUS_ERROR,
  STATUS_WARNING,
  STATUS_SUCCESS,
} from '@/lib/chart-colors';

// These guard the consolidated hex-interpolation + quality→color helpers that
// AggregateQualityDashboard now reads instead of hand-rolling its own
// lerpColor / qualityToColor / qualityToAccent.
describe('lerpHexColor', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(lerpHexColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpHexColor('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('mixes channels at the midpoint', () => {
    expect(lerpHexColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps t outside [0,1]', () => {
    expect(lerpHexColor('#000000', '#ffffff', -1)).toBe('#000000');
    expect(lerpHexColor('#000000', '#ffffff', 2)).toBe('#ffffff');
  });
});

describe('heatmapScale (refactored onto lerpHexColor)', () => {
  it('still returns the endpoint stops for t<=0 and t>=1', () => {
    expect(heatmapScale(0)).toBe(HEATMAP_STEP_1);
    expect(heatmapScale(1)).toBe(HEATMAP_STEP_5);
  });

  it('produces a valid hex color for a midpoint', () => {
    expect(heatmapScale(0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('qualityCellColor', () => {
  it('renders the neutral --border surface when un-reviewed or score-less', () => {
    expect(qualityCellColor(3, 0)).toBe('var(--border)'); // pctReviewed === 0
    expect(qualityCellColor(null, 1)).toBe('var(--border)');
  });

  it('maps 1/3/5 quality to the low/mid/high heatmap stops', () => {
    expect(qualityCellColor(1, 1)).toBe(QUALITY_HEATMAP_LOW);
    expect(qualityCellColor(3, 1)).toBe(QUALITY_HEATMAP_MID);
    expect(qualityCellColor(5, 1)).toBe(QUALITY_HEATMAP_HIGH);
  });
});

describe('qualityAccentColor', () => {
  it('falls back to --text-muted when un-reviewed or score-less', () => {
    expect(qualityAccentColor(3, 0)).toBe('var(--text-muted)');
    expect(qualityAccentColor(null, 1)).toBe('var(--text-muted)');
  });

  it('maps 1/3/5 quality to the error/warning/success ramp', () => {
    expect(qualityAccentColor(1, 1)).toBe(STATUS_ERROR);
    expect(qualityAccentColor(3, 1)).toBe(STATUS_WARNING);
    expect(qualityAccentColor(5, 1)).toBe(STATUS_SUCCESS);
  });
});
