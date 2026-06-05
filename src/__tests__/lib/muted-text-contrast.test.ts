import { describe, it, expect } from 'vitest';

/**
 * Muted-text contrast audit (WCAG 2.x AA, success criterion 1.4.3, ≥ 4.5:1 for
 * normal body text). Locks the conclusion of the typography pass that paired the
 * 12px readable floor with a contrast sweep of `text-text-muted` on the dark
 * surface ladder.
 *
 * The hexes mirror the `:root` tokens in `src/app/globals.css`; the WCAG math is
 * inlined here so the guard stands alone (it asserts a design rule, not a util).
 * If those tokens move, update the constants below — the point is to encode the
 * rule the call sites rely on:
 *
 *   - `--text-muted` at FULL opacity clears AA on every standard surface, so muted
 *     body copy is fine *as long as it is not dimmed further*.
 *   - The moment an opacity modifier (`/70`, `/60`, …) is stacked on a dark
 *     surface it drops below AA — the failure mode this pass promotes back to a
 *     solid token. See sub_ability/index.tsx (subtitle, dropped `/70`) and
 *     gas-balance/StatInput.tsx (hint, dropped `opacity-60`).
 *   - `--text` clears AA everywhere, so it is always a safe promotion target.
 */

const AA_TEXT = 4.5;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Flatten a translucent foreground (alpha 0–1) over an opaque background. */
function blendOver(fg: string, alpha: number, bg: string): string {
  const [fr, fgn, fb] = hexToRgb(fg);
  const [br, bgn, bb] = hexToRgb(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(mix(fr, br))}${h(mix(fgn, bgn))}${h(mix(fb, bb))}`;
}

const TEXT = '#e0e4f0';
const TEXT_MUTED = '#9aa0c4';
const SURFACES = {
  background: '#0a0a16',
  surface: '#1e1e3a',
  'surface-deep': '#14142c',
} as const;

describe('muted-text contrast audit', () => {
  it('text-muted at full opacity meets AA on every standard surface', () => {
    for (const bg of Object.values(SURFACES)) {
      expect(contrastRatio(TEXT_MUTED, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('text-muted dimmed to /70 or /60 falls below AA on dark surfaces', () => {
    // Why descriptive copy must not stack an opacity modifier on muted: the blend
    // toward the dark surface eats the contrast headroom.
    for (const bg of [SURFACES.surface, SURFACES['surface-deep']]) {
      expect(contrastRatio(blendOver(TEXT_MUTED, 0.7, bg), bg)).toBeLessThan(AA_TEXT);
      expect(contrastRatio(blendOver(TEXT_MUTED, 0.6, bg), bg)).toBeLessThan(AA_TEXT);
    }
  });

  it('text (the promotion target) clears AA on every standard surface', () => {
    for (const bg of Object.values(SURFACES)) {
      expect(contrastRatio(TEXT, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
