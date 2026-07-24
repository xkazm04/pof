import type { FeelPreset } from '@/lib/character-feel-optimizer';
import type { AdjustmentLayer } from '@/lib/feel-adjustment-layers';
import type { CurvePoint } from './types';
import { presetToAccelCurve, presetToDodgeCurve, presetToCameraCurve } from './curve-math';

/* ── Session-scoped curve cache ────────────────────────────────────────────────
 * The Feel Playground is unmounted whenever the user switches Character Blueprint
 * sub-tabs (the tab body is keyed by activeTab), so hand-tuned curves used to be
 * discarded silently on every navigation. This module keeps the last edited set
 * alive for the lifetime of the page, stamped with the seed it was derived from.
 *
 * Deliberately NOT persisted to localStorage: curves are a working surface, and
 * restoring them across reloads against a preset/layer stack that may have moved
 * on would be a lie about where the numbers came from. A signature mismatch
 * (different base preset or a changed adjustment-layer stack) reseeds honestly. */

export interface CurveSet {
  accel: CurvePoint[];
  dodge: CurvePoint[];
  camera: CurvePoint[];
}

interface CachedCurves {
  signature: string;
  curves: CurveSet;
}

let cache: CachedCurves | null = null;

/**
 * Identity of the feel the curves were seeded from — base preset plus the
 * adjustment-layer stack that resolves on top of it. Any change reseeds.
 */
export function seedSignature(basePresetId: string, layers: AdjustmentLayer[]): string {
  const layerPart = layers
    .filter((l) => l.enabled)
    .map((l) => `${l.id}:${l.modifiers.map((m) => `${m.field}${m.op}${m.value}`).join(',')}`)
    .join('|');
  return `${basePresetId}::${layerPart}`;
}

/** Fresh curves derived from a resolved preset (base + enabled layers). */
export function seedCurves(resolved: FeelPreset): CurveSet {
  return {
    accel: presetToAccelCurve(resolved),
    dodge: presetToDodgeCurve(resolved),
    camera: presetToCameraCurve(resolved),
  };
}

/** Cached curves for this seed, or null when the seed has moved on. */
export function readCurves(signature: string): CurveSet | null {
  return cache?.signature === signature ? cache.curves : null;
}

export function writeCurves(signature: string, curves: CurveSet): void {
  cache = { signature, curves };
}

/** Test/reset hook — drops the cache so the next mount reseeds. */
export function clearCurveCache(): void {
  cache = null;
}
