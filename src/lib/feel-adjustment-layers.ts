/**
 * Feel Adjustment Layers
 *
 * Non-destructive modifier stack for character "feel" — the Photoshop /
 * Houdini adjustment-layer pattern. A base FeelProfile stays authoritative
 * while named layers (Boss Encounter, Frenzy buff, Low Health…) stack on top.
 * Each layer toggles on/off and can be reordered; `resolveStack` flattens the
 * base + enabled layers into a single resolved FeelProfile that feeds the
 * radar, playground, and CLI-apply prompt unchanged.
 */

import {
  FEEL_FIELD_META,
  getNestedValue,
  type FeelProfile,
} from '@/lib/character-feel-optimizer';
import {
  ACCENT_ORANGE, ACCENT_CYAN, ACCENT_VIOLET, STATUS_ERROR, STATUS_WARNING,
} from '@/lib/chart-colors';

/* ── Types ────────────────────────────────────────────────────────────────── */

/** How a layer modifier combines with the value beneath it. */
export type LayerOp = 'pct' | 'add' | 'set';

export interface LayerModifier {
  /** Dotted field path matching a FEEL_FIELD_META key, e.g. `movement.turnRate`. */
  field: string;
  op: LayerOp;
  /** `pct`: percent change (-20 → −20%). `add`: absolute delta. `set`: absolute value. */
  value: number;
}

export interface AdjustmentLayer {
  id: string;
  name: string;
  enabled: boolean;
  /** Optional accent color for the stack viewer. */
  color?: string;
  modifiers: LayerModifier[];
}

export interface LayerTemplate {
  templateId: string;
  name: string;
  description: string;
  color: string;
  modifiers: LayerModifier[];
}

const LAYER_OPS: ReadonlySet<string> = new Set<LayerOp>(['pct', 'add', 'set']);

/* ── Field metadata helpers ───────────────────────────────────────────────── */

const FIELD_META_BY_KEY = new Map(FEEL_FIELD_META.map((m) => [m.key, m] as const));

/** Prettify a dotted field path for fields with no metadata entry. */
function prettifyField(field: string): string {
  const last = field.split('.').pop() ?? field;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Human label for a field path — prefers FEEL_FIELD_META, falls back to prettified key. */
export function fieldLabel(field: string): string {
  return FIELD_META_BY_KEY.get(field)?.label ?? prettifyField(field);
}

function clampToMeta(field: string, value: number): number {
  const meta = FIELD_META_BY_KEY.get(field);
  if (!meta) return value;
  return Math.min(Math.max(value, meta.min), meta.max);
}

/* ── Nested set (non-destructive) ─────────────────────────────────────────── */

function setNestedValue(profile: FeelProfile, path: string, value: number): void {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = profile;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]];
    if (obj == null) return;
  }
  const leaf = parts[parts.length - 1];
  if (obj && typeof obj[leaf] === 'number') {
    obj[leaf] = value;
  }
}

function cloneProfile(profile: FeelProfile): FeelProfile {
  return JSON.parse(JSON.stringify(profile)) as FeelProfile;
}

/* ── Resolution ───────────────────────────────────────────────────────────── */

function applyOp(current: number, mod: LayerModifier): number {
  switch (mod.op) {
    case 'pct': return current * (1 + mod.value / 100);
    case 'add': return current + mod.value;
    case 'set': return mod.value;
    default: return current;
  }
}

/**
 * Flatten `base` + enabled `layers` (top-to-bottom in array order) into a single
 * resolved FeelProfile. The base is never mutated; resolved values are clamped to
 * the field's metadata range when one exists.
 */
export function resolveStack(base: FeelProfile, layers: AdjustmentLayer[]): FeelProfile {
  const result = cloneProfile(base);
  for (const layer of layers) {
    if (!layer.enabled) continue;
    for (const mod of layer.modifiers) {
      const current = getNestedValue(result, mod.field);
      const next = clampToMeta(mod.field, applyOp(current, mod));
      setNestedValue(result, mod.field, next);
    }
  }
  return result;
}

/** Count of enabled layers in a stack — handy for summary chips. */
export function countActiveLayers(layers: AdjustmentLayer[]): number {
  return layers.reduce((n, l) => n + (l.enabled ? 1 : 0), 0);
}

/* ── Descriptions ─────────────────────────────────────────────────────────── */

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** One-line description of a single modifier, e.g. "Turn Rate -20%". */
export function describeModifier(mod: LayerModifier): string {
  const label = fieldLabel(mod.field);
  switch (mod.op) {
    case 'pct': return `${label} ${signed(mod.value)}%`;
    case 'add': return `${label} ${signed(mod.value)}`;
    case 'set': return `${label} = ${mod.value}`;
    default: return label;
  }
}

/** One-line description of a layer's combined modifiers. */
export function describeLayer(layer: AdjustmentLayer): string {
  if (layer.modifiers.length === 0) return 'No modifiers';
  return layer.modifiers.map(describeModifier).join(', ');
}

/* ── Id generation ────────────────────────────────────────────────────────── */

/** Layer id — called from store actions / event handlers, never during render. */
function createLayerId(): string {
  return `layer_${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Templates ────────────────────────────────────────────────────────────── */

export const LAYER_TEMPLATES: LayerTemplate[] = [
  {
    templateId: 'boss-encounter',
    name: 'Boss Encounter',
    description: 'Tighter turning and wider commitment windows for telegraphed fights',
    color: ACCENT_ORANGE,
    modifiers: [
      { field: 'movement.turnRate', op: 'pct', value: -20 },
      { field: 'combat.comboWindowMs', op: 'pct', value: 15 },
    ],
  },
  {
    templateId: 'frenzy',
    name: 'Frenzy Buff',
    description: 'Faster attacks and movement during a rage / berserk window',
    color: STATUS_ERROR,
    modifiers: [
      { field: 'combat.attackSpeed', op: 'pct', value: 30 },
      { field: 'movement.maxWalkSpeed', op: 'pct', value: 10 },
    ],
  },
  {
    templateId: 'low-health',
    name: 'Low Health',
    description: 'Heavier, more deliberate feel when the player is near death',
    color: STATUS_WARNING,
    modifiers: [
      { field: 'movement.maxWalkSpeed', op: 'pct', value: -15 },
      { field: 'dodge.staminaCost', op: 'pct', value: 25 },
      { field: 'camera.fovBase', op: 'pct', value: -5 },
    ],
  },
  {
    templateId: 'adrenaline',
    name: 'Adrenaline Rush',
    description: 'Snappier evasion and faster sprints for a temporary speed boost',
    color: ACCENT_CYAN,
    modifiers: [
      { field: 'movement.maxSprintSpeed', op: 'pct', value: 20 },
      { field: 'dodge.cooldown', op: 'pct', value: -30 },
    ],
  },
  {
    templateId: 'encumbered',
    name: 'Encumbered',
    description: 'Sluggish acceleration and shorter dodges under heavy load',
    color: ACCENT_VIOLET,
    modifiers: [
      { field: 'movement.acceleration', op: 'pct', value: -25 },
      { field: 'dodge.distance', op: 'pct', value: -20 },
      { field: 'movement.maxWalkSpeed', op: 'pct', value: -10 },
    ],
  },
];

const TEMPLATE_BY_ID = new Map(LAYER_TEMPLATES.map((t) => [t.templateId, t] as const));

/** Build a fresh, enabled layer from a template, with cloned modifiers and a unique id. */
export function createLayerFromTemplate(templateId: string): AdjustmentLayer | null {
  const tpl = TEMPLATE_BY_ID.get(templateId);
  if (!tpl) return null;
  return {
    id: createLayerId(),
    name: tpl.name,
    enabled: true,
    color: tpl.color,
    modifiers: tpl.modifiers.map((m) => ({ ...m })),
  };
}

/** Build a fresh, empty, enabled layer the user can fill in. */
export function createBlankLayer(name = 'New Layer'): AdjustmentLayer {
  return { id: createLayerId(), name, enabled: true, modifiers: [] };
}

/* ── Reorder (pure) ───────────────────────────────────────────────────────── */

/** Move a layer up or down within the stack. Returns a new array; no-op at boundaries. */
export function moveLayer(layers: AdjustmentLayer[], id: string, dir: 'up' | 'down'): AdjustmentLayer[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return layers;
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= layers.length) return layers;
  const next = [...layers];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/* ── Sanitization (for persist rehydration) ───────────────────────────────── */

function isValidModifier(raw: unknown): raw is LayerModifier {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  return typeof m.field === 'string'
    && typeof m.op === 'string' && LAYER_OPS.has(m.op)
    && typeof m.value === 'number' && Number.isFinite(m.value);
}

/**
 * Validate/repair persisted layers on rehydration. A layer is dropped when it is
 * not an object, is missing a string name/id, lacks a modifiers array, or had
 * modifiers that were ALL invalid (corrupt) — an intentionally empty layer is
 * kept. Duplicate ids are regenerated so a corrupt save can't make toggle/remove
 * target the wrong layer.
 */
export function sanitizeLayers(raw: unknown): AdjustmentLayer[] {
  if (!Array.isArray(raw)) return [];
  const out: AdjustmentLayer[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string') continue;
    if (typeof e.id !== 'string' || e.id.length === 0) continue;
    if (!Array.isArray(e.modifiers)) continue;
    const rawMods = e.modifiers as unknown[];
    const modifiers = rawMods.filter(isValidModifier).map((m) => ({ ...m }));
    // A layer that had modifiers but lost them all to corruption is dropped;
    // a layer that was authored empty (no modifiers) is kept.
    if (rawMods.length > 0 && modifiers.length === 0) continue;
    let id = e.id;
    while (seen.has(id)) id = createLayerId();
    seen.add(id);
    out.push({
      id,
      name: e.name,
      enabled: e.enabled !== false,
      ...(typeof e.color === 'string' ? { color: e.color } : {}),
      modifiers,
    });
  }
  return out;
}
