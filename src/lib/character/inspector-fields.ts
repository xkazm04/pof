/**
 * Property Inspector ⇄ feel stack seam.
 *
 * The Character Blueprint's Property Inspector is a view and editor of the
 * persisted feel stack (base preset + adjustment layers), the same resolved
 * profile Playground, AI Feel and the Apply-to-UE prompt run on. Rows derive
 * from `resolveStack`; an edit becomes a `set` modifier in ONE reserved layer
 * (`INSPECTOR_LAYER_ID`) that sits in `feelLayers` like any other layer, so the
 * existing persistence, sanitization, layer-stack UI and Apply prompt carry it.
 *
 * Fields FeelProfile does not model are listed as read-only "not applied" rows
 * and counted — never presented as values that reach UE.
 */

import {
  FEEL_FIELD_META,
  FEEL_PRESETS,
  getNestedValue,
  type FeelPreset,
  type FeelProfile,
} from '@/lib/character-feel-optimizer';
import { resolveStack, type AdjustmentLayer } from '@/lib/feel-adjustment-layers';

export const INSPECTOR_LAYER_ID = 'inspector-overrides';
export const INSPECTOR_LAYER_NAME = 'Inspector overrides';

export type InspectorCategory = 'Movement' | 'Combat' | 'Camera';

/** Inspector (UPROPERTY-style) name → FeelProfile dotted path. */
export const INSPECTOR_FIELDS: ReadonlyArray<{ name: string; category: InspectorCategory; field: string }> = [
  { name: 'MaxWalkSpeed', category: 'Movement', field: 'movement.maxWalkSpeed' },
  { name: 'MaxSprintSpeed', category: 'Movement', field: 'movement.maxSprintSpeed' },
  { name: 'JumpZVelocity', category: 'Movement', field: 'movement.jumpZVelocity' },
  { name: 'GravityScale', category: 'Movement', field: 'movement.gravityScale' },
  { name: 'AirControl', category: 'Movement', field: 'movement.airControl' },
  { name: 'BaseDamage', category: 'Combat', field: 'combat.baseDamage' },
  { name: 'CritMultiplier', category: 'Combat', field: 'combat.critMultiplier' },
  { name: 'AttackSpeed', category: 'Combat', field: 'combat.attackSpeed' },
  { name: 'HitStunDuration', category: 'Combat', field: 'combat.hitReactionDuration' },
  { name: 'ArmLength', category: 'Camera', field: 'camera.armLength' },
  { name: 'FOV', category: 'Camera', field: 'camera.fovBase' },
  { name: 'LagSpeed', category: 'Camera', field: 'camera.lagSpeed' },
];

/** Blueprint properties FeelProfile does not model — shown read-only, never applied. */
export const INSPECTOR_UNMAPPED: ReadonlyArray<{ name: string; category: InspectorCategory; value: number | string }> = [
  { name: 'BlockReduction', category: 'Combat', value: 0.5 },
  { name: 'CameraOffset', category: 'Camera', value: '0,60,0' },
  { name: 'RotationLag', category: 'Camera', value: 8 },
];

export interface InspectorRow {
  name: string;
  category: InspectorCategory;
  /** FeelProfile path; null for an unmapped property. */
  field: string | null;
  /** Resolved value (base + enabled layers). */
  current: number | string;
  /** Base-preset value. */
  defaultVal: number | string;
  isModified: boolean;
  /** Whether the value reaches UE through the Apply prompt. */
  applies: boolean;
  editable: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface InspectorView {
  rows: InspectorRow[];
  unmappedCount: number;
}

const META_BY_KEY = new Map(FEEL_FIELD_META.map((m) => [m.key, m] as const));
const FIELD_BY_NAME = new Map(INSPECTOR_FIELDS.map((f) => [f.name, f.field] as const));

/** The persisted base preset id → preset (falls back to the default base). */
export function findBasePreset(id: string): FeelPreset {
  return FEEL_PRESETS.find((p) => p.id === id) ?? FEEL_PRESETS[0];
}

function stepFor(min: number, max: number): number {
  return max - min <= 5 ? 0.05 : 1;
}

/** Build the inspector rows from the base profile and the adjustment-layer stack. */
export function inspectorRows(base: FeelProfile, layers: AdjustmentLayer[]): InspectorView {
  const resolved = resolveStack(base, layers);
  const mapped: InspectorRow[] = INSPECTOR_FIELDS.map(({ name, category, field }) => {
    const current = getNestedValue(resolved, field);
    const defaultVal = getNestedValue(base, field);
    const meta = META_BY_KEY.get(field);
    return {
      name, category, field, current, defaultVal,
      isModified: current !== defaultVal,
      applies: true,
      editable: true,
      ...(meta ? { min: meta.min, max: meta.max, step: stepFor(meta.min, meta.max) } : {}),
    };
  });
  const unmapped: InspectorRow[] = INSPECTOR_UNMAPPED.map(({ name, category, value }) => ({
    name, category, field: null, current: value, defaultVal: value,
    isModified: false, applies: false, editable: false,
  }));
  return { rows: [...mapped, ...unmapped], unmappedCount: unmapped.length };
}

function clampToMeta(field: string, value: number): number {
  const meta = META_BY_KEY.get(field);
  return meta ? Math.min(Math.max(value, meta.min), meta.max) : value;
}

/**
 * Upsert the inspector's `set` modifier for `name`. One reserved layer holds
 * every inspector edit (appended on top on first use, re-enabled on edit); a
 * repeat edit replaces the field's modifier. Setting the value the stack would
 * produce beneath the inspector layer removes the modifier, and an emptied
 * layer is dropped. Unknown names return `layers` unchanged.
 */
export function setInspectorOverride(
  layers: AdjustmentLayer[],
  name: string,
  value: number,
  base: FeelProfile,
): AdjustmentLayer[] {
  const field = FIELD_BY_NAME.get(name);
  if (!field || !Number.isFinite(value)) return layers;
  const next = clampToMeta(field, value);

  const idx = layers.findIndex((l) => l.id === INSPECTOR_LAYER_ID);
  const beneathLayers = idx === -1 ? layers : layers.slice(0, idx);
  const beneath = getNestedValue(resolveStack(base, beneathLayers), field);

  const existing = idx === -1 ? null : layers[idx];
  const others = (existing?.modifiers ?? []).filter((m) => m.field !== field);
  const modifiers = next === beneath ? others : [...others, { field, op: 'set' as const, value: next }];

  if (modifiers.length === 0) return idx === -1 ? layers : layers.filter((_, i) => i !== idx);
  const layer: AdjustmentLayer = existing
    ? { ...existing, enabled: true, modifiers }
    : { id: INSPECTOR_LAYER_ID, name: INSPECTOR_LAYER_NAME, enabled: true, modifiers };
  return idx === -1 ? [...layers, layer] : layers.map((l, i) => (i === idx ? layer : l));
}

/** Remove the inspector overrides layer (other layers untouched). */
export function clearInspectorOverrides(layers: AdjustmentLayer[]): AdjustmentLayer[] {
  return layers.filter((l) => l.id !== INSPECTOR_LAYER_ID);
}

/** Features-tab CameraMetric values from a resolved profile. */
export function cameraMetricValues(profile: FeelProfile): { fov: number; arm: number; lag: number } {
  return { fov: profile.camera.fovBase, arm: profile.camera.armLength, lag: profile.camera.lagSpeed };
}
