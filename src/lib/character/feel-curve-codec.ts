/**
 * Feel-curve codec — the Feel Playground's curves as ONE invertible view of the
 * persisted feel stack.
 *
 * `CURVE_CHANNELS` binds each of the 11 curve-tunable FeelProfile fields to
 * exactly one coordinate (x or y) of one point of one curve, with the value range
 * read from FEEL_FIELD_META (the range `resolveStack` clamps to — no second range
 * table). `encodeCurves` and `decodeCurves` are both derived from that table, so
 * decoding an encoded profile gives the profile back, and moving one bound
 * coordinate changes exactly one field. Coordinates no field is bound to only
 * shape the curve and are never decoded.
 *
 * Curves are not state: the Playground renders `encodeCurves(resolved stack)`, and
 * a drag becomes `set` modifiers in the reserved `playground-curves` layer via
 * `applyCurveEdit` (the shared reserved-layer upsert the Property Inspector uses),
 * so curve edits persist, reach every Apply path and survive preset/layer changes.
 */

import {
  FEEL_FIELD_META,
  getNestedValue,
  type FeelProfile,
} from '@/lib/character-feel-optimizer';
import {
  resolveStack,
  upsertReservedSets,
  type AdjustmentLayer,
} from '@/lib/feel-adjustment-layers';

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface CurvePoint {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

export type CurveId = 'accel' | 'dodge' | 'camera';
export type CurveSet = Record<CurveId, CurvePoint[]>;
/** Decoded field values keyed by FeelProfile dotted path. */
export type CurveValues = Record<string, number>;

export interface CurveChannel {
  field: string;
  curve: CurveId;
  /** Point index within the curve (always an interior, draggable point). */
  index: number;
  axis: 'x' | 'y';
  /** Coordinate at meta.min / meta.max (lo > hi inverts the axis). */
  lo: number;
  hi: number;
  /** Value range — FEEL_FIELD_META's row for `field`. */
  min: number;
  max: number;
  label: string;
  unit: string;
  /** Decimals a decoded value is rounded to. */
  decimals: number;
}

export const PLAYGROUND_LAYER_ID = 'playground-curves';
export const PLAYGROUND_LAYER_NAME = 'Playground curves';
const PLAYGROUND_LAYER = { id: PLAYGROUND_LAYER_ID, name: PLAYGROUND_LAYER_NAME };

/* ── Channel table ────────────────────────────────────────────────────────── */

type ChannelSpec = Pick<CurveChannel, 'field' | 'curve' | 'index' | 'axis' | 'lo' | 'hi' | 'decimals'>;

const SPECS: ChannelSpec[] = [
  // Acceleration: ramp to walk, hold, ramp to sprint, release and brake to 0.
  { field: 'movement.acceleration', curve: 'accel', index: 1, axis: 'x', lo: 0.3, hi: 0.06, decimals: 0 },
  { field: 'movement.maxWalkSpeed', curve: 'accel', index: 2, axis: 'y', lo: 0.15, hi: 0.6, decimals: 0 },
  { field: 'movement.maxSprintSpeed', curve: 'accel', index: 3, axis: 'y', lo: 0.4, hi: 1, decimals: 0 },
  { field: 'movement.deceleration', curve: 'accel', index: 4, axis: 'x', lo: 0.62, hi: 0.92, decimals: 0 },
  // Dodge: i-frames open, peak distance, i-frames close, dodge ends.
  { field: 'dodge.iFrameStart', curve: 'dodge', index: 1, axis: 'x', lo: 0.04, hi: 0.2, decimals: 2 },
  { field: 'dodge.distance', curve: 'dodge', index: 2, axis: 'y', lo: 0.2, hi: 1, decimals: 0 },
  { field: 'dodge.iFrameDuration', curve: 'dodge', index: 3, axis: 'x', lo: 0.3, hi: 0.6, decimals: 2 },
  { field: 'dodge.duration', curve: 'dodge', index: 4, axis: 'x', lo: 0.66, hi: 0.95, decimals: 2 },
  // Camera: early response = lag speed, mid = FOV, settle = arm length.
  { field: 'camera.lagSpeed', curve: 'camera', index: 1, axis: 'y', lo: 0.1, hi: 0.8, decimals: 1 },
  { field: 'camera.fovBase', curve: 'camera', index: 3, axis: 'y', lo: 0.2, hi: 0.9, decimals: 0 },
  { field: 'camera.armLength', curve: 'camera', index: 4, axis: 'y', lo: 0.25, hi: 1, decimals: 0 },
];

export const CURVE_CHANNELS: readonly CurveChannel[] = SPECS.map((spec) => {
  const meta = FEEL_FIELD_META.find((m) => m.key === spec.field);
  if (!meta) throw new Error(`feel-curve-codec: no FEEL_FIELD_META row for ${spec.field}`);
  return { ...spec, min: meta.min, max: meta.max, label: meta.label, unit: meta.unit };
});

const CHANNEL_BY_FIELD = new Map(CURVE_CHANNELS.map((c) => [c.field, c] as const));

/* ── Coordinate math ──────────────────────────────────────────────────────── */

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Normalized position of `value` in the field's FEEL_FIELD_META range (0-1). */
export function channelT(field: string, value: number): number {
  const ch = CHANNEL_BY_FIELD.get(field);
  if (!ch || ch.max === ch.min) return 0;
  return clamp01((value - ch.min) / (ch.max - ch.min));
}

/** The bound coordinate that encodes `value` for `field`. */
export function channelCoord(field: string, value: number): number {
  const ch = CHANNEL_BY_FIELD.get(field);
  if (!ch) return 0;
  return ch.lo + (ch.hi - ch.lo) * channelT(field, value);
}

function decodeChannel(ch: CurveChannel, coord: number): number {
  const t = ch.hi === ch.lo ? 0 : clamp01((coord - ch.lo) / (ch.hi - ch.lo));
  return Number((ch.min + (ch.max - ch.min) * t).toFixed(ch.decimals));
}

/** A value rounded to the precision its handle can express. */
function quantize(ch: CurveChannel, value: number): number {
  return Number(value.toFixed(ch.decimals));
}

/* ── Encode / decode ──────────────────────────────────────────────────────── */

/** The three curves for a (resolved) profile. Unbound coordinates only shape. */
export function encodeCurves(profile: FeelProfile): CurveSet {
  const c = (field: string) => channelCoord(field, getNestedValue(profile, field));
  const walkY = c('movement.maxWalkSpeed');
  const sprintY = c('movement.maxSprintSpeed');
  const distY = c('dodge.distance');
  const lagY = c('camera.lagSpeed');
  const armY = c('camera.armLength');
  return {
    accel: [
      { x: 0, y: 0 },
      { x: c('movement.acceleration'), y: walkY },
      { x: 0.4, y: walkY },
      { x: 0.52, y: sprintY },
      { x: c('movement.deceleration'), y: sprintY },
      { x: 1, y: 0 },
    ],
    dodge: [
      { x: 0, y: 0 },
      { x: c('dodge.iFrameStart'), y: distY * 0.7 },
      { x: 0.25, y: distY },
      { x: c('dodge.iFrameDuration'), y: distY * 0.85 },
      { x: c('dodge.duration'), y: distY * 0.3 },
      { x: 1, y: 0 },
    ],
    camera: [
      { x: 0, y: 0 },
      { x: 0.15, y: lagY },
      { x: 0.35, y: (lagY + armY) / 2 },
      { x: 0.55, y: c('camera.fovBase') },
      { x: 0.8, y: armY },
      { x: 1, y: armY },
    ],
  };
}

/** Values of the fields bound to one curve, each read from its own coordinate. */
export function decodeCurve(curve: CurveId, points: CurvePoint[]): CurveValues {
  const out: CurveValues = {};
  for (const ch of CURVE_CHANNELS) {
    if (ch.curve !== curve) continue;
    const pt = points[ch.index];
    if (pt) out[ch.field] = decodeChannel(ch, pt[ch.axis]);
  }
  return out;
}

/** All 11 bound field values. */
export function decodeCurves(curves: CurveSet): CurveValues {
  return {
    ...decodeCurve('accel', curves.accel),
    ...decodeCurve('dodge', curves.dodge),
    ...decodeCurve('camera', curves.camera),
  };
}

/** Point indices a user may drag on `curve` — exactly the bound handles. */
export function boundIndices(curve: CurveId): number[] {
  return CURVE_CHANNELS.filter((c) => c.curve === curve).map((c) => c.index);
}

/* ── Curve edit → persisted stack ─────────────────────────────────────────── */

/**
 * A drag on `curve` → `set` modifiers in the reserved `playground-curves` layer.
 * Only fields whose decoded value changed versus the curves of the current
 * resolved stack are written; a value equal to what the stack produces beneath
 * the reserved layer removes that field's modifier (an emptied layer is dropped).
 * Returns `layers` itself when nothing changed.
 */
export function applyCurveEdit(
  layers: AdjustmentLayer[],
  base: FeelProfile,
  curve: CurveId,
  points: CurvePoint[],
): AdjustmentLayer[] {
  const current = decodeCurve(curve, encodeCurves(resolveStack(base, layers))[curve]);
  const edited = decodeCurve(curve, points);
  const idx = layers.findIndex((l) => l.id === PLAYGROUND_LAYER_ID);
  const beneath = resolveStack(base, idx === -1 ? layers : layers.slice(0, idx));

  const entries: { field: string; value: number }[] = [];
  for (const [field, value] of Object.entries(edited)) {
    if (value === current[field]) continue;
    const ch = CHANNEL_BY_FIELD.get(field)!;
    const under = getNestedValue(beneath, field);
    // Back at the handle's reading of the value beneath → pass that exact value so
    // the upsert removes the modifier instead of pinning a rounded copy.
    entries.push({ field, value: quantize(ch, under) === value ? under : value });
  }
  if (entries.length === 0) return layers;
  return upsertReservedSets(layers, PLAYGROUND_LAYER, entries, base);
}

/** Remove the playground curves layer (other layers untouched). */
export function clearPlaygroundCurves(layers: AdjustmentLayer[]): AdjustmentLayer[] {
  return layers.filter((l) => l.id !== PLAYGROUND_LAYER_ID);
}
