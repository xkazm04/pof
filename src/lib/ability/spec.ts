import type { EditorEffect, TagRule } from '@/lib/gas-codegen';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';

export type { EditorEffect, TagRule };

/** Per-entity enriched GAS authoring spec — drives the rich editors (B2) + C++ codegen (B3). */
export interface EnrichedAbilitySpec {
  catalogId: string;
  entityId: string;
  effects: EditorEffect[];
  tagRules: TagRule[];
  updatedAt?: string;
}

/** The thin fields `deriveDefaultSpec` needs from a SpellbookAbility. */
export interface AbilityLike {
  id: string;
  element?: string;
  color?: string;
  damage?: number;
  cooldown?: number;
  tag?: string;
}

/**
 * Seed a starter spec from the thin ability so the B2 editors are never empty:
 * one element-themed instant effect (Health −damage) carrying the cooldown, plus
 * the standard "can't act while incapacitated" activation blocks. Pure.
 */
export function deriveDefaultSpec(catalogId: string, ability: AbilityLike): EnrichedAbilitySpec {
  const tag = ability.tag ?? 'Ability';
  const effects: EditorEffect[] = [{
    id: `${ability.id}-primary`,
    name: ability.element ? `${ability.element} Strike` : 'Effect',
    duration: 'instant',
    durationSec: 0,
    cooldownSec: ability.cooldown ?? 0,
    color: ability.color ?? STATUS_NEUTRAL,
    modifiers: [{ attribute: 'Health', operation: 'add', magnitude: ability.damage ? -ability.damage : 0 }],
    grantedTags: [],
  }];
  const tagRules: TagRule[] = [
    { id: `${ability.id}-block-dead`, sourceTag: tag, targetTag: 'State.Dead', type: 'blocks' },
    { id: `${ability.id}-block-stunned`, sourceTag: tag, targetTag: 'State.Stunned', type: 'blocks' },
  ];
  return { catalogId, entityId: ability.id, effects, tagRules };
}
