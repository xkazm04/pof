import { mergeSpecWrite, type EnrichedAbilitySpec, type TagRule } from '@/lib/ability/spec';

/**
 * Adopt with eyes open: the two pure facts the forge's Adopt bar needs before
 * it persists a forged ability into a spellbook entity —
 *  1. WHICH entity (ranked targets from data the spellbook already holds), and
 *  2. WHAT the write will replace there, derived from the same slice-merge the
 *     server applies (`mergeSpecWrite`: absent key = keep, null = clear).
 */

/** The forge signal a target is ranked on: [Damage, Range, AoE, Speed, Efficiency]. */
export interface AdoptTargetSignal {
  damageType: string;
  radarValues: readonly number[];
}

/** The thin fields ranking needs from a SpellbookAbility. */
export interface AdoptCandidate {
  id: string;
  name: string;
  element: string;
  radar: readonly number[];
}

export interface AdoptSuggestion {
  id: string;
  name: string;
  element: string;
  elementMatch: boolean;
  /** Euclidean radar distance to the forge (0 = identical profile). */
  distance: number;
  /** Short human reason, e.g. "Ice · radar Δ0.10". */
  reason: string;
}

const RADAR_AXES = 5;

function axis(v: readonly number[], i: number): number {
  const x = v[i];
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

function radarDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < RADAR_AXES; i++) sum += (axis(a, i) - axis(b, i)) ** 2;
  return Math.sqrt(sum);
}

/**
 * Rank adopt targets: an element match first (a forge's damageType that no
 * ability carries — e.g. `None` — ranks every element on radar alone), then the
 * nearest radar profile; ties keep catalog order. Pure.
 */
export function suggestAdoptTargets(
  forged: AdoptTargetSignal,
  abilities: readonly AdoptCandidate[],
  limit = 3,
): AdoptSuggestion[] {
  const element = forged.damageType.trim().toLowerCase();
  return abilities
    .map((a, order) => {
      const elementMatch = element !== '' && a.element.toLowerCase() === element;
      const distance = radarDistance(forged.radarValues, a.radar);
      return { a, order, elementMatch, distance };
    })
    .sort((x, y) =>
      Number(y.elementMatch) - Number(x.elementMatch) || x.distance - y.distance || x.order - y.order)
    .slice(0, Math.max(0, limit))
    .map(({ a, elementMatch, distance }) => ({
      id: a.id, name: a.name, element: a.element, elementMatch, distance,
      reason: `${elementMatch ? a.element : 'radar only'} · radar Δ${distance.toFixed(2)}`,
    }));
}

export type AdoptPreviewStatus = 'unloaded' | 'fresh' | 'replaces';

/** Name-keyed diff of one replaced slice (effects by name, tag rules by `source type target`). */
export interface SliceDiff {
  added: string[];
  removed: string[];
  /** Same key on both sides, different content. */
  changed: string[];
}

/** The optional slices an Adopt never names, so the slice-merge keeps them. */
export type KeptSlice = 'attributes' | 'relationships' | 'loadout';

export interface AdoptPreview {
  /** unloaded = target spec not read yet (or the read failed); fresh = nothing real replaced. */
  status: AdoptPreviewStatus;
  effects: SliceDiff;
  tagRules: SliceDiff;
  /** A DIFFERENT prior forge whose provenance this adopt overwrites. */
  supersedes: { className: string; displayName: string } | null;
  /** UE holds confirmed generated code for the spec this adopt changes. */
  codegenAtRisk: boolean;
  /** Authored slices present on the target that the merge leaves untouched. */
  keeps: KeptSlice[];
  /** Adopt must go through an explicit confirmation. */
  needsConfirm: boolean;
}

const KEPT_SLICES: readonly KeptSlice[] = ['attributes', 'relationships', 'loadout'];
const EMPTY_DIFF: SliceDiff = { added: [], removed: [], changed: [] };

export function tagRuleLabel(r: TagRule): string {
  return `${r.sourceTag} ${r.type} ${r.targetTag}`;
}

function diffBy<T>(before: readonly T[], after: readonly T[], key: (t: T) => string): SliceDiff {
  const prev = new Map(before.map((t) => [key(t), t]));
  const next = new Map(after.map((t) => [key(t), t]));
  const added = [...next.keys()].filter((k) => !prev.has(k));
  const removed = [...prev.keys()].filter((k) => !next.has(k));
  const changed = [...next.keys()].filter(
    (k) => prev.has(k) && JSON.stringify(prev.get(k)) !== JSON.stringify(next.get(k)));
  return { added, removed, changed };
}

const touches = (d: SliceDiff) => d.added.length + d.removed.length + d.changed.length > 0;

/**
 * What adopting `next` into a target whose stored spec is `current` will do:
 * `undefined` = not loaded (unknown → confirm), `null` = no stored row (fresh).
 * The kept/replaced split is read off `mergeSpecWrite`, the server's own rule,
 * so the preview cannot promise a keep the write would not honour. Pure.
 */
export function previewAdopt(
  current: EnrichedAbilitySpec | null | undefined,
  next: EnrichedAbilitySpec,
): AdoptPreview {
  if (current === undefined) {
    return {
      status: 'unloaded',
      effects: { ...EMPTY_DIFF, added: next.effects.map((e) => e.name) },
      tagRules: { ...EMPTY_DIFF, added: next.tagRules.map(tagRuleLabel) },
      supersedes: null, codegenAtRisk: false, keeps: [], needsConfirm: true,
    };
  }
  const merged = mergeSpecWrite(current, next);
  const effects = diffBy(current?.effects ?? [], merged.effects, (e) => e.name);
  const tagRules = diffBy(current?.tagRules ?? [], merged.tagRules, tagRuleLabel);

  const prior = current?.provenance;
  const supersedes = prior && prior.className !== merged.provenance?.className
    ? { className: prior.className, displayName: prior.displayName }
    : null;
  const changesSpec = touches(effects) || touches(tagRules) || supersedes !== null;
  const codegenAtRisk = current?.codegen?.status === 'confirmed' && changesSpec;
  const keeps = KEPT_SLICES.filter((k) => {
    const slice = current?.[k];
    return Array.isArray(slice) && slice.length > 0 && merged[k] === slice;
  });
  const destroys = effects.removed.length + effects.changed.length
    + tagRules.removed.length + tagRules.changed.length > 0;
  const replaces = destroys || supersedes !== null || codegenAtRisk;

  return {
    status: replaces ? 'replaces' : 'fresh',
    effects, tagRules, supersedes, codegenAtRisk, keeps,
    needsConfirm: replaces,
  };
}
