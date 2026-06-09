/**
 * WCAG 2.x contrast utilities.
 *
 * Used to verify that the semantic colors carrying meaning in charts — legend
 * swatches, status-bar fills, marker lines — stand out enough against the
 * surface they sit on. Two relevant success criteria:
 *   - 1.4.3 (text contrast):      ≥ 4.5:1 normal text, ≥ 3:1 large/bold text.
 *   - 1.4.11 (non-text contrast): ≥ 3:1 for graphical objects (bars, swatches).
 *
 * Translucent fills (e.g. `bg-amber-400/50`) are flattened onto their backing
 * surface with {@link blendOver} before measuring, since that blend is what the
 * eye actually sees.
 */

/** WCAG AA threshold for normal body text. */
export const WCAG_AA_TEXT = 4.5;
/** WCAG AA threshold for large/bold text and graphical (non-text) objects. */
export const WCAG_AA_NON_TEXT = 3;

/** Parse a `#rgb` or `#rrggbb` hex string to an `[r, g, b]` tuple (0–255). */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
}

/**
 * Flatten a translucent foreground color (alpha 0–1) over an opaque background,
 * returning the resulting opaque `#rrggbb` — the color the viewer perceives.
 */
export function blendOver(fg: string, alpha: number, bg: string): string {
  const [fr, fgn, fb] = hexToRgb(fg);
  const [br, bgn, bb] = hexToRgb(bg);
  const a = Math.max(0, Math.min(1, alpha));
  return `#${toHex(fr * a + br * (1 - a))}${toHex(fgn * a + bgn * (1 - a))}${toHex(fb * a + bb * (1 - a))}`;
}

/** WCAG relative luminance of a hex color (0–1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * True when `fg` (optionally translucent at `alpha`) meets the WCAG AA contrast
 * threshold for `level` against `bg`.
 */
export function meetsContrastAA(
  fg: string,
  bg: string,
  level: 'text' | 'non-text' = 'text',
  alpha = 1,
): boolean {
  const effective = alpha >= 1 ? fg : blendOver(fg, alpha, bg);
  const threshold = level === 'text' ? WCAG_AA_TEXT : WCAG_AA_NON_TEXT;
  return contrastRatio(effective, bg) >= threshold;
}
