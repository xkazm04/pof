/**
 * Character input bindings - one pure resolver over (defaults, overrides).
 *
 * The Input tab's table, keyboard map, mouse widget, ability badges and the
 * Features KeyboardMetric all read ONE `resolveBindings` value, so a rebind can
 * never show on one surface and not another. Overrides are a sparse
 * `action -> key` record persisted in `characterBlueprintStore`; the store and
 * the CLI Apply dispatch sit at the edge, everything here is IO-free.
 */

export interface BindingDef {
  action: string;
  defaultKey: string;
  handler: string;
  featureName: string;
}

export type BindingOverrides = Record<string, string>;

export interface ResolvedBinding extends BindingDef {
  /** Effective key after overrides (may be a group such as the movement cluster). */
  key: string;
  overridden: boolean;
}

export interface BindingChange { action: string; from: string; to: string }

export interface ResolvedBindings {
  effective: ResolvedBinding[];
  byAction: Map<string, ResolvedBinding>;
  /** Physical key (groups expanded) -> first action bound to it. */
  keyMap: Map<string, ResolvedBinding>;
  /** Physical key -> every action bound to it, only where more than one. */
  conflicts: Map<string, string[]>;
  changed: BindingChange[];
}

export type ApplyGate = { ok: true } | { ok: false; reason: string };

const KEY_GROUPS: Record<string, readonly string[]> = {
  WASD: ['W', 'A', 'S', 'D'],
};

const MOUSE_KEYS = new Set(['Mouse', 'LMB', 'RMB']);

/** A binding key -> the physical keys it occupies (the movement cluster expands). */
export function expandKey(key: string): string[] {
  return [...(KEY_GROUPS[key] ?? [key])];
}

export function isMouseKey(key: string): boolean {
  return MOUSE_KEYS.has(key);
}

export function resolveBindings(defaults: readonly BindingDef[], overrides: BindingOverrides): ResolvedBindings {
  const effective: ResolvedBinding[] = [];
  const byAction = new Map<string, ResolvedBinding>();
  const keyMap = new Map<string, ResolvedBinding>();
  const keyToActions = new Map<string, string[]>();
  const changed: BindingChange[] = [];

  for (const def of defaults) {
    const override = overrides[def.action];
    const key = typeof override === 'string' && override !== '' ? override : def.defaultKey;
    const entry: ResolvedBinding = { ...def, key, overridden: key !== def.defaultKey };
    effective.push(entry);
    byAction.set(def.action, entry);
    if (entry.overridden) changed.push({ action: def.action, from: def.defaultKey, to: key });
    for (const k of expandKey(key)) {
      if (!keyMap.has(k)) keyMap.set(k, entry);
      keyToActions.set(k, [...(keyToActions.get(k) ?? []), def.action]);
    }
  }

  const conflicts = new Map<string, string[]>();
  for (const [k, actions] of keyToActions) if (actions.length > 1) conflicts.set(k, actions);
  return { effective, byAction, keyMap, conflicts, changed };
}

/**
 * Bind `action` to `newKey`. When another action holds exactly `newKey` and
 * neither side is a key group, the two swap; a group is never silently swapped
 * (the collision stays visible as a conflict instead). Overrides equal to the
 * default are dropped so "no overrides" always means "factory defaults".
 */
export function rebindAction(
  defaults: readonly BindingDef[],
  overrides: BindingOverrides,
  action: string,
  newKey: string,
): BindingOverrides {
  const { byAction, effective } = resolveBindings(defaults, overrides);
  const target = byAction.get(action);
  if (!target || !newKey || target.key === newKey) return overrides;

  const next: BindingOverrides = { ...overrides, [action]: newKey };
  const holder = effective.find((b) => b.action !== action && b.key === newKey);
  const isGroup = (k: string) => expandKey(k).length > 1;
  if (holder && !isGroup(newKey) && !isGroup(target.key)) next[holder.action] = target.key;

  for (const def of defaults) if (next[def.action] === def.defaultKey) delete next[def.action];
  return next;
}

/** Keep only overrides for known actions with non-empty string keys (persisted-state guard). */
export function sanitizeBindingOverrides(raw: unknown, defaults: readonly BindingDef[]): BindingOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BindingOverrides = {};
  for (const def of defaults) {
    const v = (raw as Record<string, unknown>)[def.action];
    if (typeof v === 'string' && v !== '' && v !== def.defaultKey) out[def.action] = v;
  }
  return out;
}

/** Whether "Apply to IMC_Default" may run, and if not, the reason shown next to it. */
export function bindingsApplyGate(resolved: ResolvedBindings): ApplyGate {
  const first = resolved.conflicts.entries().next();
  if (!first.done) {
    const [key, actions] = first.value;
    const more = resolved.conflicts.size > 1 ? ` (+${resolved.conflicts.size - 1} more)` : '';
    return { ok: false, reason: `conflict on ${key}: ${actions.join(', ')}${more}` };
  }
  if (resolved.changed.length === 0) return { ok: false, reason: 'matches defaults' };
  return { ok: true };
}

/** KeyboardEvent.key -> the binding label the table and keyboard map use. */
export function normalizeKeyEvent(key: string): string {
  const named: Record<string, string> = {
    ' ': 'Space', control: 'Ctrl', shift: 'Shift', alt: 'Alt', tab: 'Tab',
    arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right',
  };
  return named[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key);
}
