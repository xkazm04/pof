import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface CurvePoint {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

export interface DerivedGenomeValues {
  // Movement
  maxWalkSpeed: number;
  maxSprintSpeed: number;
  acceleration: number;
  deceleration: number;
  // Dodge
  dodgeDistance: number;
  dodgeDuration: number;
  iFrameStart: number;
  iFrameDuration: number;
  // Camera
  armLength: number;
  lagSpeed: number;
  fovBase: number;
}

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

/** Ranges for deriving genome values from normalized 0-1 curve positions */
export const VALUE_RANGES = {
  maxWalkSpeed: [200, 600],
  maxSprintSpeed: [400, 1000],
  acceleration: [800, 4500],
  deceleration: [1200, 4500],
  dodgeDistance: [150, 600],
  dodgeDuration: [0.15, 0.9],
  iFrameStart: [0.0, 0.15],
  iFrameDuration: [0.05, 0.5],
  armLength: [300, 1200],
  lagSpeed: [3, 20],
  fovBase: [70, 110],
} as const;

/* ── Math helpers ──────────────────────────────────────────────────────────── */

export function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

export function invLerp(min: number, max: number, v: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}
