import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  blendOver,
  relativeLuminance,
  contrastRatio,
  meetsContrastAA,
  WCAG_AA_TEXT,
  WCAG_AA_NON_TEXT,
} from '@/lib/contrast';
import {
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_ERROR,
  STATUS_INFO,
  ACCENT_EMERALD,
  ACCENT_CYAN_LIGHT,
} from '@/lib/chart-colors';

// Surfaces the combat charts render on (from globals.css).
const SURFACE = '#1e1e3a';       // raised card — distribution bars sit here
const SURFACE_DEEP = '#14142c';  // inset well — heatmap / threat bar tracks
const BODY_TEXT = '#e0e4f0';     // --text, the legend label color

describe('contrast — WCAG primitives', () => {
  it('parses hex (short + long form)', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#f87171')).toEqual([248, 113, 113]);
  });

  it('computes the canonical black/white contrast ratio (21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('luminance is ordered white > mid > black', () => {
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(relativeLuminance('#808080'));
    expect(relativeLuminance('#808080')).toBeGreaterThan(relativeLuminance('#000000'));
  });

  it('blendOver flattens a translucent fill toward its background', () => {
    expect(blendOver('#ffffff', 1, '#000000')).toBe('#ffffff');
    expect(blendOver('#ffffff', 0, '#000000')).toBe('#000000');
    expect(blendOver('#ffffff', 0.5, '#000000')).toBe('#808080');
  });
});

describe('contrast — legend label + swatch colors meet WCAG AA', () => {
  // Solid semantic colors used as ChartLegend swatches (graphical objects).
  const SWATCHES = [STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, ACCENT_EMERALD, ACCENT_CYAN_LIGHT];

  it('every legend swatch clears the 3:1 non-text threshold on both surfaces', () => {
    for (const color of SWATCHES) {
      expect(contrastRatio(color, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      expect(contrastRatio(color, SURFACE_DEEP)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
  });

  it('legend label text clears the 4.5:1 normal-text threshold', () => {
    expect(contrastRatio(BODY_TEXT, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(BODY_TEXT, SURFACE_DEEP)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe('contrast — combat chart status fills meet WCAG 1.4.11 (≥ 3:1)', () => {
  // The exact translucent fills used by CombatSimulatorView, flattened onto the
  // surface each bar visibly sits against. These opacities were chosen *because*
  // the verification below failed at the original faint values (/30–/40).
  const FILLS: { label: string; color: string; alpha: number; bg: string }[] = [
    { label: 'heatmap used (cyan/50)',        color: ACCENT_CYAN_LIGHT, alpha: 0.5, bg: SURFACE_DEEP },
    { label: 'heatmap under-used (amber/50)', color: STATUS_WARNING,    alpha: 0.5, bg: SURFACE_DEEP },
    { label: 'threat damage-share (amber/50)',color: STATUS_WARNING,    alpha: 0.5, bg: SURFACE_DEEP },
    { label: 'threat kill-share (red/70)',    color: STATUS_ERROR,      alpha: 0.7, bg: SURFACE_DEEP },
    { label: 'dist damage-dealt (emerald/70)',color: ACCENT_EMERALD,    alpha: 0.7, bg: SURFACE },
    { label: 'dist damage-taken (red/70)',    color: STATUS_ERROR,      alpha: 0.7, bg: SURFACE },
    { label: 'dist duration (blue/70)',       color: STATUS_INFO,       alpha: 0.7, bg: SURFACE },
  ];

  for (const fill of FILLS) {
    it(`${fill.label} is visible against its track`, () => {
      expect(meetsContrastAA(fill.color, fill.bg, 'non-text', fill.alpha)).toBe(true);
    });
  }

  it('documents that the original faint fills (/30) would FAIL — proving the bump was needed', () => {
    // amber damage-share at the old 30% opacity is invisible-grade (< 3:1).
    expect(meetsContrastAA(STATUS_WARNING, SURFACE_DEEP, 'non-text', 0.3)).toBe(false);
  });
});
