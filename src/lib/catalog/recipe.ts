import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityEntry, CatalogEntityBase, ItemEntry, LifecycleState, LootTableEntry, BestiaryEntry, CombatInteractionEntry, ScreenEntry, ZoneEntry, AnimationEntry } from '@/lib/catalog/types';
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
  testPath: 'Project.Functional Tests.Maps.VS09Ability.VSAbility09Test',
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

const ITEM_BEST_PRACTICES = [
  'Author a `UARPGItemDefinition` data asset (Python, FULL editor via -ExecutePythonScript), not -run=pythonscript.',
  'Set the item type/rarity/stats from the Asset Specification; do not invent new fields.',
  'Place the asset under `/Game/Items/` and report its content path.',
];

export const ITEMS_RECIPE: GenerationRecipe<ItemEntry> = {
  id: 'items-definition',
  catalogId: 'items',
  steps: ['author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author a UARPGItemDefinition data asset for "${entity.name}" from its spec.`
        : step === 'wire'
          ? `Register "${entity.name}" so it is discoverable by the item registry / a loot table.`
          : `Run the item-definitions functional test; assert the asset loads with valid fields.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('UARPGItemDefinition data-asset authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Items · ${step}`, task)
      .withBestPractices(ITEM_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const LOOT_BEST_PRACTICES = [
  'Author a `UARPGLootTable` data asset (Python, FULL editor) with weighted entries from the spec.',
  'Preserve the configured drop chance and rarity weights; do not invent items.',
  'Place the asset under `/Game/Loot/` and report its content path.',
];

export const LOOT_RECIPE: GenerationRecipe<LootTableEntry> = {
  id: 'loot-table',
  catalogId: 'loot-tables',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSLoot.VSLootDistributionTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author a UARPGLootTable data asset "${entity.name}" with the spec's weighted entries.`
        : `Run the loot-distribution functional test; assert empirical drops match the configured weights within tolerance.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('UARPGLootTable data-asset authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Loot · ${step}`, task)
      .withBestPractices(LOOT_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const BESTIARY_BEST_PRACTICES = [
  'Author a `BP_<id>Enemy` Blueprint subclassing `AARPGEnemyCharacter` via FULL editor (-ExecutePythonScript), not -run=pythonscript.',
  'Grant the archetype\'s abilities on the placed instance (CDO-vs-instance trap — Python set_editor_property bakes the native default into the .umap, silently beating the CDO at PIE load).',
  'Use the strong-red `M_EnemyRed` material variant by default for visual distinction from the player.',
  'Place the asset under `/Game/Enemies/` and report its content path.',
];

export const BESTIARY_RECIPE: GenerationRecipe<BestiaryEntry> = {
  id: 'bestiary-archetype',
  catalogId: 'bestiary',
  steps: ['author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSBestiary.VSBestiary_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author the BP_${entity.data.id}Enemy Blueprint subclassing AARPGEnemyCharacter from "${entity.name}"'s spec.`
        : step === 'wire'
          ? `Wire BP_${entity.data.id}Enemy: grant its abilities (cross-catalog links provide spellbook ids) + bind the loot table (lt-${entity.data.id}) on the placed instance.`
          : `Run AVSBestiary_${entity.data.id}Test: spawn → chases + attacks (player Health drops) → drops linked loot on death.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('AARPGEnemyCharacter Blueprint authoring + cross-catalog wiring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Bestiary · ${step}`, task)
      .withBestPractices(BESTIARY_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const COMBAT_MAP_BEST_PRACTICES = [
  'Combat Map is wiring of EXISTING abilities — do not author new GAs or assets.',
  'Wire each combo step (`Ability → HitReact montage → Damage tag`) on the placed-instance damage table; the CDO can be stale (CDO-vs-instance trap).',
  'Use GAS `SetByCaller Data.Damage.Base` for damage, never hardcoded GE magnitudes.',
];

export const COMBAT_MAP_RECIPE: GenerationRecipe<CombatInteractionEntry> = {
  id: 'combat-map-interaction',
  catalogId: 'combat-map',
  steps: ['wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSCombat.VSCombat_DamageMatrixTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'wire'
        ? `Wire combo "${entity.name}" (${entity.data.weaponCategory}): connect each chain step to its HitReact montage + Damage tag on the placed-instance damage table.`
        : `Run VSCombat_DamageMatrixTest: assert each interaction applies the expected damage/reaction to the target.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Combat interaction wiring (no new assets) for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Combat Map · ${step}`, task)
      .withBestPractices(COMBAT_MAP_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const SCREEN_FLOW_BEST_PRACTICES = [
  'Scaffold a pure-C++ `UUserWidget` subclass extending `UARPGCodeWidgetBase` (folder-04 keystone) — do NOT use `meta=(BindWidget)`.',
  'Build the widget tree in `RebuildWidget()` (not `NativeConstruct` — the RebuildWidget timing trap).',
  'Place the header under `Source/PoF/UI/` and the WBP stub (if any) under `/Game/UI/`.',
  'Wire transitions into the screen-flow state machine; never assume a stale CDO.',
];

export const SCREEN_FLOW_RECIPE: GenerationRecipe<ScreenEntry> = {
  id: 'screen-flow-screen',
  catalogId: 'screen-flow',
  steps: ['scaffold-cpp', 'author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSScreens.VSScreen_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const cls = `U${entity.data.id}Widget`;
    const task =
      step === 'scaffold-cpp'
        ? `Scaffold ${cls} extending UARPGCodeWidgetBase (pure-C++, build the tree in RebuildWidget()).`
        : step === 'author-python'
          ? `Author the WBP_${entity.data.id} stub if BindWidget meta is unavoidable; otherwise pure-C++ is preferred.`
          : step === 'wire'
            ? `Wire screen "${entity.name}" into the screen-flow state machine (push/pop/replace), respecting its group "${entity.data.group ?? 'Misc'}".`
            : `Run VSScreen_${entity.data.id}Test: widget mounts/binds/transitions; bar moves on attribute change.`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Pure-C++ UMG widgets (UARPGCodeWidgetBase) for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Screen Flow · ${step}`, task)
      .withBestPractices(SCREEN_FLOW_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const ZONE_MAP_BEST_PRACTICES = [
  'Author the `.umap` via a `build_<zone_id>.py` script run through the FULL editor (-ExecutePythonScript), extending the proven `build_arena.py` / `build_procgen_dungeon.py` pattern.',
  'Place the map under `/Game/Maps/` and report its content path.',
  'Set Movable lights for headless cooks (Lightmass bake is skipped headlessly — folder-05 lesson).',
  'Spawn placement: use ZONE_EDGES portals + Bestiary archetype links (resolved at recipe time, not seed time).',
];

export const ZONE_MAP_RECIPE: GenerationRecipe<ZoneEntry> = {
  id: 'zone-map-zone',
  catalogId: 'zone-map',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSZone.VSZone_DefaultTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author /Game/Maps/${entity.data.id}.umap via a build_${entity.data.id}.py script (FULL editor): floor + lights + PlayerStart + zone-specific placement + portals from ZONE_EDGES.`
        : `Run VSZone_${entity.data.id}Test: player spawns, nav exists, encounter triggers; layout sane (Gemini-vision optional).`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Zone (.umap) authoring + spawn/nav placement for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Zone Map · ${step}`, task)
      .withBestPractices(ZONE_MAP_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const STATE_GRAPH_BEST_PRACTICES = [
  'MANUAL STEP REQUIRED: the AnimBP graph (state machine, transitions, blendspaces, notify graphs) CANNOT be authored from Python. After this recipe completes, the operator must finish the AnimBP graph in the UE AnimBP editor by hand.',
  'Use the proven mixamo_pipeline.py pattern: download from Mixamo → retarget to SK_Mannequin → create the montage shell.',
  'Place montage assets under `/Game/Animations/` and report their content paths.',
  '`verify` only gates Python-authorable parts (montage asset exists + correct skeleton). Never claim the AnimBP graph is complete.',
];

export const STATE_GRAPH_RECIPE: GenerationRecipe<AnimationEntry> = {
  id: 'state-graph-montage',
  catalogId: 'state-graph',
  steps: ['author-python', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSAnim.VSAnim_LocomotionTest',
  buildStepPrompt(entity, step, ctx) {
    const task =
      step === 'author-python'
        ? `Author the ${entity.data.name} montage shell from Mixamo (retarget to SK_Mannequin); place under /Game/Animations/${entity.data.category}/. Do NOT touch the AnimBP graph.`
        : `Run VSAnim_LocomotionTest: AnimInstance locomotion state updates under movement (the Python-authorable verify; AnimBP graph completeness is the operator's manual responsibility).`;
    const b = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Mixamo + montage authoring for the PoF ARPG. AnimBP graph stays manual.')
      .withAssetSpec(entity)
      .withTask(`State Graph · ${step}`, task)
      .withBestPractices(STATE_GRAPH_BEST_PRACTICES);
    if (step === 'verify') b.withSuccessCriteria([`The functional test \`${this.testPath}\` returns Result={Success}.`]);
    return b.build();
  },
};

const RECIPES: Record<string, GenerationRecipe> = {
  spellbook: SPELLBOOK_RECIPE,
  items: ITEMS_RECIPE,
  'loot-tables': LOOT_RECIPE,
  bestiary: BESTIARY_RECIPE,
  'combat-map': COMBAT_MAP_RECIPE,
  'screen-flow': SCREEN_FLOW_RECIPE,
  'zone-map': ZONE_MAP_RECIPE,
  'state-graph': STATE_GRAPH_RECIPE,
};

/** The recipe for a catalog, or undefined if none is registered yet. */
export function getRecipe(catalogId: string): GenerationRecipe | undefined {
  return RECIPES[catalogId];
}
