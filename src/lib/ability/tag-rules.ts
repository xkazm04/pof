/**
 * Tag rules — ONE direction for a `TagRule`, and the binder that gets every
 * rule into it.
 *
 * Canonical form is **ability-owned**: `sourceTag` is the ability the rule
 * lives on, `targetTag` is the gating tag, and `type` names the GAS container
 * it lands in (`blocks` → ActivationBlockedTags, `requires` →
 * ActivationRequiredTags, `cancels` → CancelAbilitiesWithTag). That is what GAS
 * itself stores (the containers live on the ability), and what deriveDefaultSpec,
 * forge adoption, the draft-spec callback and the generate prompt already speak.
 *
 * The archetype templates are written the other way round — as patterns
 * ("State.Dead blocks Ability.*") that describe a whole kit. `bindRulesToAbility`
 * is the one boundary where such a pattern becomes the bound ability's own rule:
 * it flips a pattern that targets this ability, drops (with a named reason) one
 * that targets another ability or is a state→state effect-level rule, and
 * passes an already ability-owned rule through unchanged — so binding twice is
 * a no-op.
 *
 * Pure: no I/O, no React.
 */
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';

/** Why a rule could not become one of the bound ability's activation rules. */
export type DropReason =
  /** Targets (or is owned by) a different ability — wiring it here would gate the wrong thing. */
  | 'other-ability'
  /** State→state (or a subject-side cancel): the effect granting the tag owns it, not the ability. */
  | 'effect-level'
  /** Same (ability, gating tag, type) as an earlier rule. */
  | 'duplicate';

export interface DroppedRule { ruleId: string; reason: DropReason }
export interface BoundRules { rules: TagRule[]; dropped: DroppedRule[] }
export interface EffectRuleLink { effectId: string; ruleId: string }

/**
 * Do two tag patterns name overlapping tags? Exact, `X.*` wildcard on either
 * side, or GAS hierarchy (a parent tag matches its children).
 */
export function tagsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith('.*') && b.startsWith(a.slice(0, -1))) return true;
  if (b.endsWith('.*') && a.startsWith(b.slice(0, -1))) return true;
  return a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

/** Is `tag` an ability tag (or pattern) rather than a state / cooldown / combo subject? */
function isAbilitySide(tag: string, abilityTag: string): boolean {
  return tag === 'Ability' || tag.startsWith('Ability.') || tagsOverlap(tag, abilityTag);
}

function bindOne(r: TagRule, abilityTag: string): TagRule | DropReason {
  if (isAbilitySide(r.sourceTag, abilityTag)) {
    // Already ability-owned: keep it when it is (or covers) this ability.
    if (r.sourceTag === abilityTag) return r;
    return tagsOverlap(r.sourceTag, abilityTag) ? { ...r, sourceTag: abilityTag } : 'other-ability';
  }
  if (!isAbilitySide(r.targetTag, abilityTag)) return 'effect-level';
  if (!tagsOverlap(r.targetTag, abilityTag)) return 'other-ability';
  // "X cancels Ability.*" means the effect granting X cancels the ability;
  // flipping it would say the reverse (activating this ability cancels X).
  if (r.type === 'cancels') return 'effect-level';
  return { id: r.id, sourceTag: abilityTag, targetTag: r.sourceTag, type: r.type };
}

/** Bind archetype / mixed-direction rules onto one ability, in canonical (ability-owned) form. */
export function bindRulesToAbility(rules: readonly TagRule[], abilityTag: string): BoundRules {
  const out: TagRule[] = [];
  const dropped: DroppedRule[] = [];
  const seen = new Set<string>();
  for (const r of rules) {
    const bound = bindOne(r, abilityTag);
    if (typeof bound === 'string') { dropped.push({ ruleId: r.id, reason: bound }); continue; }
    const key = `${bound.type}|${bound.targetTag}`;
    if (seen.has(key)) { dropped.push({ ruleId: r.id, reason: 'duplicate' }); continue; }
    seen.add(key);
    out.push(bound);
  }
  return { rules: out, dropped };
}

/** The tag that gates the ability (canonical form: the target). */
export function ruleGatingTag(rule: TagRule): string {
  return rule.targetTag;
}

/** How a rule reads from the ability's side of the sentence. */
export const RULE_VERB: Record<TagRule['type'], string> = {
  blocks: 'blocked by',
  requires: 'requires',
  cancels: 'cancels',
};

/** "blocked by State.Dead" — the rule read from its owning ability. */
export function ruleSentence(rule: TagRule): string {
  return `${RULE_VERB[rule.type]} ${ruleGatingTag(rule)}`;
}

/** Effect → rule links: an effect granting a rule's gating tag drives that rule. */
export function effectRuleLinks(effects: readonly EditorEffect[], rules: readonly TagRule[]): EffectRuleLink[] {
  const links: EffectRuleLink[] = [];
  for (const e of effects) {
    for (const r of rules) {
      const gate = ruleGatingTag(r);
      if (e.grantedTags.some((t) => tagsOverlap(t, gate))) links.push({ effectId: e.id, ruleId: r.id });
    }
  }
  return links;
}
