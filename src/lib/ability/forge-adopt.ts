import { STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import type { EnrichedAbilitySpec, SpecProvenance } from '@/lib/ability/spec';

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
 */
export function forgedAbilityToSpec(
  catalogId: string,
  entityId: string,
  forged: ForgedAbility,
  prompt?: string,
): EnrichedAbilitySpec {
  const slug = slugOf(forged.className);
  const owned = forged.tags.ownedTags ?? [];

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

  const blocked = forged.tags.blockedTags?.length ? forged.tags.blockedTags : ['State.Dead', 'State.Stunned'];
  const abilityTag = forged.tags.abilityTag || slug;
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
