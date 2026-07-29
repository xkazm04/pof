import { STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { EnrichedAbilitySpec, SpecProvenance } from '@/lib/ability/spec';
import { toDottedTag, toDottedTags } from '@/lib/ability/tag-dialect';

/** GA_Fireball → fireball (stable id prefix for the generated effects). */
function slugOf(className: string): string {
  return className.replace(/^GA_/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'ability';
}

/**
 * Map a {@link ForgedAbility} to an {@link EnrichedAbilitySpec} for a target
 * entity. **Pure** — deterministic, no clock/IO — so it is unit-testable and
 * safe to call in render.
 *
 * Conservative mapping (name / effects only, per the adopt contract):
 *  - a primary instant damage effect (Health −baseDamage) carrying the cooldown
 *    and the ability's ActivationOwned tags;
 *  - a mana-cost effect when manaCost > 0;
 *  - one `blocks` tag rule per ActivationBlocked tag (falling back to the
 *    State.Dead / State.Stunned guards when the forge left them empty).
 *
 * The raw generated C++ + the prompt ride along as {@link SpecProvenance} — the
 * app stores them for audit but never writes C++ files; UE materialization is
 * the generateGasEffects agent task's job.
 *
 * **Dialect:** the forge emits C++ tag identifiers (`Ability_Fireball`) while
 * specs, spellbook data and the tag audit speak dotted tag strings. Every tag
 * crossing this boundary is normalized through `@/lib/ability/tag-dialect` so an
 * adopted row can actually match a declared tag. The generated C++ in the
 * provenance keeps its identifiers untouched — that is engine syntax, not a tag.
 */
export function forgedAbilityToSpec(
  catalogId: string,
  entityId: string,
  forged: ForgedAbility,
  prompt?: string,
): EnrichedAbilitySpec {
  const slug = slugOf(forged.className);
  const owned = toDottedTags(forged.tags.ownedTags ?? []);

  const effects: EditorEffect[] = [
    {
      id: `${slug}-primary`,
      name: `GE_${forged.className.replace(/^GA_/, '')}_Impact`,
      duration: 'instant',
      durationSec: 0,
      cooldownSec: forged.stats.cooldownSec ?? 0,
      color: STATUS_NEUTRAL,
      modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -(forged.stats.baseDamage ?? 0) }],
      grantedTags: owned,
    },
  ];
  if ((forged.stats.manaCost ?? 0) > 0) {
    effects.push({
      id: `${slug}-mana`,
      name: `GE_${forged.className.replace(/^GA_/, '')}_ManaCost`,
      duration: 'instant',
      durationSec: 0,
      cooldownSec: 0,
      color: STATUS_NEUTRAL,
      modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: -forged.stats.manaCost }],
      grantedTags: [],
    });
  }

  const blockedRaw = toDottedTags(forged.tags.blockedTags ?? []);
  const blocked = blockedRaw.length ? blockedRaw : ['State.Dead', 'State.Stunned'];
  const abilityTag = toDottedTag(forged.tags.abilityTag || '') || slug;
  const tagRules: TagRule[] = blocked.map((targetTag, i) => ({
    id: `${slug}-block-${i}`,
    sourceTag: abilityTag,
    targetTag,
    type: 'blocks' as const,
  }));

  const provenance: SpecProvenance = {
    source: 'forge',
    className: forged.className,
    displayName: forged.displayName,
    damageType: forged.stats.damageType,
    prompt,
    headerCode: forged.headerCode,
    cppCode: forged.cppCode,
  };

  return { catalogId, entityId, effects, tagRules, provenance };
}
