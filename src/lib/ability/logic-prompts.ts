export const LOGIC_ASPECTS = ['type', 'damage', 'cooldown', 'cost', 'effects', 'requirements'] as const;
export type LogicAspect = (typeof LOGIC_ASPECTS)[number];

export interface AbilityRef {
  name: string;
  element: string;
  tag: string;
  category: string;
  tier: string;
}

const ASPECT_INTENT: Record<LogicAspect, string> = {
  type: 'change the classification (category / element / tier) and its gameplay tag',
  damage: 'tune the base damage and how it scales',
  cooldown: 'change the cooldown duration (and its cooldown GE/tag)',
  cost: 'tune the mana/resource cost',
  effects: 'author the GameplayEffects this ability applies (DoT / buff / debuff via GAS)',
  requirements: 'set the activation requirements (activation-owned / activation-blocked tags)',
};

/**
 * CLI prompt to change one Logic aspect of a spellbook ability. Edits the SOURCE
 * (the UARPGGameplayAbility subclass + DT_AbilityCatalog row) reusing existing GAS
 * conventions — never invents a new system. Pure; SpellbookLogicWorkspace dispatches it.
 */
export function buildLogicChangePrompt(aspect: LogicAspect, ability: AbilityRef, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `For the spellbook ability "${ability.name}" (gameplay tag ${ability.tag}, ${ability.category}/${ability.element}/${ability.tier}), ${ASPECT_INTENT[aspect]}.`,
    trimmed
      ? `Designer intent: "${trimmed}"`
      : 'No extra intent — propose a sensible improvement and confirm before applying.',
    'Edit the existing UARPGGameplayAbility subclass and its DT_AbilityCatalog row (FARPGAbilityCatalogRow); reuse the existing GAS effect/tag conventions — do not invent a new system.',
    `Report the asset path and the exact fields you changed for ${ability.name}.`,
  ].join('\n');
}
