import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityEntry, CatalogEntityBase, LifecycleState } from '@/lib/catalog/types';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';

export type GenerationStep = 'scaffold-cpp' | 'author-python' | 'wire' | 'verify';

/** The lifecycle a completed step advances the entity to. */
export const STEP_TO_LIFECYCLE: Record<GenerationStep, LifecycleState> = {
  'scaffold-cpp': 'scaffolded',
  'author-python': 'generated',
  'wire': 'wired',
  'verify': 'verified',
};

export interface GenerationRecipe<T extends CatalogEntityBase = CatalogEntityBase> {
  id: string;
  catalogId: string;
  steps: GenerationStep[];
  /** Functional test that gates the verify step. */
  testPath?: string;
  buildStepPrompt(entity: T, step: GenerationStep, ctx: ProjectContext): string;
}

/** GAS conventions carried into every Spellbook generation prompt (from the Ability Forge knowledge). */
const GAS_BEST_PRACTICES = [
  'The ability MUST extend `UARPGGameplayAbility` (include "AbilitySystem/ARPGGameplayAbility.h").',
  'Constructor sets SetAssetTags, ActivationOwnedTags, ActivationBlockedTags, AbilityManaCost, CooldownGameplayEffectClass, AbilityCooldownTag.',
  '`State.Dead` and `State.Stunned` are always in ActivationBlockedTags.',
  'Use SetByCaller `Data.Damage.Base` for damage, not hardcoded GameplayEffect magnitudes.',
  'Gray-box first: if the montage is empty, drive damage with a WaitDelay fallback window (the GA_MeleeAttack pattern) so the gameplay still lands.',
  'CDO-vs-instance: set class-pointer props on the placed instance, not only the CDO.',
];

const STEP_TASK: Record<GenerationStep, (e: AbilityEntry) => string> = {
  'scaffold-cpp': (e) =>
    `Scaffold the C++ \`UGameplayAbility\` subclass for "${e.name}" (activation tag \`${e.data.tag}\`). ` +
    `Create the header + cpp under Source/PoF/AbilitySystem/, compile with the editor CLOSED, then report.`,
  'author-python': (e) =>
    `Author the Blueprint config + GameplayEffect data for "${e.name}" via the FULL editor ` +
    `(\`-ExecutePythonScript=\`), not \`-run=pythonscript\`. Build the BP_GA_${e.name.replace(/\s+/g, '')} config asset.`,
  'wire': (e) =>
    `Wire "${e.name}" so it activates in-game: grant it on the player's DefaultAbilities and bind its input/tag ` +
    `(\`${e.data.tag}\`). Set class-pointer props on the placed instance, not only the CDO.`,
  'verify': (e) =>
    `Run the functional test that proves "${e.name}" works in-engine (activate by tag → target attribute changes). ` +
    `Judge success by the test result in the Automation log, not file existence.`,
};

export const SPELLBOOK_RECIPE: GenerationRecipe<AbilityEntry> = {
  id: 'spellbook-ga',
  catalogId: 'spellbook',
  steps: ['scaffold-cpp', 'author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSAbility.VSAbilityTest',
  buildStepPrompt(entity, step, ctx) {
    const builder = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Gameplay Ability System (GAS) authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Spellbook · ${step}`, STEP_TASK[step](entity))
      .withBestPractices(GAS_BEST_PRACTICES);
    if (step === 'verify') {
      builder.withSuccessCriteria([
        `The functional test \`${this.testPath}\` returns Result={Success}.`,
        `"${entity.name}" activates by tag \`${entity.data.tag}\` and changes the target's attribute.`,
      ]);
    }
    return builder.build();
  },
};

const RECIPES: Record<string, GenerationRecipe<AbilityEntry>> = {
  spellbook: SPELLBOOK_RECIPE,
};

/** The recipe for a catalog, or undefined if none is registered yet. */
export function getRecipe(catalogId: string): GenerationRecipe | undefined {
  return RECIPES[catalogId];
}
