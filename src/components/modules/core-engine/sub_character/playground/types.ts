import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';

/* ── Types ──────────────────────────────────────────────────────────────────── */

/* Curve points, the channel table and the value ranges live in the feel-curve
 * codec (ranges = FEEL_FIELD_META); this file only holds the editor geometry. */
export type { CurvePoint } from '@/lib/character/feel-curve-codec';

/* ── Constants ──────────────────────────────────────────────────────────────── */

export const SVG_W = 300;
export const SVG_H = 180;
export const PAD = { top: 15, right: 15, bottom: 25, left: 40 };
export const PLOT_W = SVG_W - PAD.left - PAD.right;
export const PLOT_H = SVG_H - PAD.top - PAD.bottom;

export const CURVE_COLORS = {
  accel: ACCENT_ORANGE,
  dodge: ACCENT_CYAN,
  camera: ACCENT_VIOLET,
};
