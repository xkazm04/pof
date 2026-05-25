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

/**
 * CLI prompt to DRAFT a starter EnrichedAbilitySpec (GameplayEffects + activation
 * tag rules) for a spellbook ability. App-side data authoring only — the callback
 * POSTs the proposed effects[]/tagRules[] to /api/ability-spec; no UE files are
 * touched. Pure; SpellbookLogicWorkspace dispatches it via "Draft with AI".
 */
export function buildAbilitySpecDraftPrompt(ability: AbilityRef, instruction: string): string {
  const trimmed = instruction.trim();
  const element = ability.element || 'physical';
  return [
    `Draft a GAS authoring spec for the spellbook ability "${ability.name}" (gameplay tag ${ability.tag || 'Ability'}, ${ability.category}/${ability.element}/${ability.tier}).`,
    `Propose the GameplayEffects it applies and the activation tag rules that gate it, reusing standard GAS conventions for a ${element} ability — do NOT invent new systems.`,
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent — propose a sensible, on-theme starter set.',
    'Each effect: id, name (GE_-style), duration ("instant"|"duration"|"infinite"), durationSec, cooldownSec, color (hex), modifiers (each {attribute, operation:"add"|"multiply", magnitude}), grantedTags (string[]).',
    'Each tag rule: id, sourceTag, targetTag, type ("blocks"|"cancels"|"requires"). Include the standard "blocked while State.Dead / State.Stunned" activation rules.',
    'This edits ONLY the app-side ability spec — do not modify any UE C++ or assets.',
  ].join('\n');
}
