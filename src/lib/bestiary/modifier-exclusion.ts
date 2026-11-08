/**
 * One rule for elite-modifier exclusions.
 *
 * The shell's per-card toggle, the Archetype Builder toggle and both "greyed
 * out" predicates used to hand-write this one-directional (they read only the
 * candidate's own `excludes`). Exclusion is a relation between two modifiers,
 * so it holds from either side: a pair declared on one modifier only still
 * conflicts when the OTHER one is the one being toggled.
 */

export interface ExclusionShape {
  id: string;
  excludes?: readonly string[];
}

/** True when `a` and `b` conflict, whichever side declares it. */
function conflicts(a: ExclusionShape | undefined, b: ExclusionShape | undefined): boolean {
  if (!a || !b) return false;
  return (a.excludes?.includes(b.id) ?? false) || (b.excludes?.includes(a.id) ?? false);
}

/** Whether `modId` cannot be activated right now because an active modifier conflicts with it. */
export function isModifierExcluded(
  modId: string,
  active: readonly string[],
  mods: readonly ExclusionShape[],
): boolean {
  if (active.includes(modId)) return false;
  const mod = mods.find(m => m.id === modId);
  return active.some(id => conflicts(mod, mods.find(m => m.id === id)));
}

/** The active list after toggling `modId`: removal, or an add that drops every conflicting modifier. */
export function toggleModifier(
  active: readonly string[],
  modId: string,
  mods: readonly ExclusionShape[],
): string[] {
  if (active.includes(modId)) return active.filter(id => id !== modId);
  const mod = mods.find(m => m.id === modId);
  const kept = active.filter(id => !conflicts(mod, mods.find(m => m.id === id)));
  return [...kept, modId];
}
