import type { SubModuleId, PartialModuleMap } from '@/types/modules';

// ─── Module-level prerequisite graph ──────────────────────────────────────────
// Defines which modules should be completed before starting another.
// Derived from the implicit aRPG curriculum order and cross-module feature deps.

export const MODULE_PREREQUISITES: Partial<Record<SubModuleId, SubModuleId[]>> = {
  // Core Engine — aRPG curriculum sequence
  'arpg-animation': ['arpg-character'],
  'arpg-gas': ['arpg-character'],
  'arpg-combat': ['arpg-gas', 'arpg-animation'],
  'arpg-enemy-ai': ['arpg-character', 'arpg-gas'],
  'arpg-inventory': ['arpg-gas'],
  'arpg-loot': ['arpg-inventory', 'arpg-combat'],
  'arpg-ui': ['arpg-gas', 'arpg-inventory'],
  'arpg-progression': ['arpg-gas', 'arpg-combat'],
  'arpg-world': ['arpg-enemy-ai', 'arpg-ui'],
  'arpg-save': ['arpg-inventory', 'arpg-gas'],
  'arpg-polish': ['arpg-combat', 'arpg-world'],

  // Content modules — lighter dependencies
  'animations': ['models'],
  'materials': ['models'],
  'level-design': ['models', 'materials'],
  'ui-hud': [],
  'audio': [],

  // Game Systems
  'ai-behavior': [],
  'physics': [],
  'multiplayer': [],
  'save-load': [],
  'input-handling': [],
  'dialogue-quests': [],
  'packaging': [],
};

/** Modules that depend on `moduleId` (i.e. moduleId is a prerequisite for them). */
function getDependents(moduleId: SubModuleId): SubModuleId[] {
  const result: SubModuleId[] = [];
  for (const [mod, prereqs] of Object.entries(MODULE_PREREQUISITES)) {
    if (prereqs && prereqs.includes(moduleId)) {
      result.push(mod as SubModuleId);
    }
  }
  return result;
}

export interface ModulePrereqStatus {
  moduleId: SubModuleId;
  label: string;
  progress: number; // 0-100
}

export interface RecommendedNextModule {
  moduleId: SubModuleId;
  label: string;
  reason: string;
}

/**
 * Compute recommended next modules for a user based on their checklist progress.
 *
 * Strategy:
 * 1. Find modules that are substantially complete (>= 70% checklist)
 * 2. For those, find dependent modules that haven't been started much (< 30%)
 * 3. Only recommend modules whose prerequisites are all >= 50% complete
 * 4. Sort by: all-prereqs-done first, then by number of prereqs satisfied
 */
export function getRecommendedNextModules(
  currentModuleId: SubModuleId,
  checklistProgress: Record<string, Record<string, boolean>>,
  checklistSizes: Record<string, number>,
): RecommendedNextModule[] {
  function moduleProgress(modId: string): number {
    const progress = checklistProgress[modId];
    const total = checklistSizes[modId] ?? 0;
    if (!progress || total === 0) return 0;
    const done = Object.values(progress).filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  const currentProgress = moduleProgress(currentModuleId);

  // Only show recommendations if the current module has meaningful progress
  if (currentProgress < 50) return [];

  const dependents = getDependents(currentModuleId);
  const results: RecommendedNextModule[] = [];

  for (const depId of dependents) {
    const depProgress = moduleProgress(depId);
    // Skip modules that are already well underway
    if (depProgress >= 50) continue;

    const prereqs = MODULE_PREREQUISITES[depId] ?? [];
    const prereqsMet = prereqs.filter((p) => moduleProgress(p) >= 50).length;
    const allPrereqsMet = prereqsMet === prereqs.length;

    // Only recommend if all prerequisites are at least 50% done
    if (!allPrereqsMet) continue;

    const reason = prereqs.length === 1
      ? `Ready — builds on this module`
      : `Ready — all ${prereqs.length} prerequisites met`;

    results.push({ moduleId: depId, label: depId, reason });
  }

  // Sort: most prerequisites satisfied first
  results.sort((a, b) => {
    const aPrereqs = MODULE_PREREQUISITES[a.moduleId]?.length ?? 0;
    const bPrereqs = MODULE_PREREQUISITES[b.moduleId]?.length ?? 0;
    return bPrereqs - aPrereqs;
  });

  return results.slice(0, 3);
}

/**
 * Get unmet prerequisites for a module (progress < 50%).
 */
export function getUnmetPrerequisites(
  moduleId: SubModuleId,
  checklistProgress: Record<string, Record<string, boolean>>,
  checklistSizes: Record<string, number>,
): ModulePrereqStatus[] {
  const prereqs = MODULE_PREREQUISITES[moduleId];
  if (!prereqs || prereqs.length === 0) return [];

  const unmet: ModulePrereqStatus[] = [];
  for (const prereqId of prereqs) {
    const progress = checklistProgress[prereqId];
    const total = checklistSizes[prereqId] ?? 0;
    let pct = 0;
    if (progress && total > 0) {
      pct = Math.round((Object.values(progress).filter(Boolean).length / total) * 100);
    }
    if (pct < 50) {
      unmet.push({ moduleId: prereqId, label: prereqId, progress: pct });
    }
  }
  return unmet;
}

export interface FeatureDefinition {
  featureName: string;
  category: string;
  description: string;
  /** Cross-module deps use "moduleId::featureName", same-module use just "featureName" */
  dependsOn?: string[];
}

export const MODULE_FEATURE_DEFINITIONS: PartialModuleMap<FeatureDefinition[]> = {
  'arpg-character': [
    { featureName: 'AARPGCharacterBase', category: 'Character', description: 'Abstract ACharacter subclass shared by player and enemies' },
    { featureName: 'AARPGPlayerCharacter', category: 'Character', description: 'Concrete player character with camera and input', dependsOn: ['AARPGCharacterBase'] },
    { featureName: 'AARPGPlayerController', category: 'Input', description: 'Player controller with Enhanced Input bindings', dependsOn: ['Enhanced Input actions'] },
    { featureName: 'Enhanced Input actions', category: 'Input', description: 'IA_Move, IA_Look, IA_Interact, IA_PrimaryAttack, IA_Dodge, IA_Sprint with IMC_Default' },
    { featureName: 'Isometric camera', category: 'Camera', description: 'Spring Arm + Camera with mouse wheel zoom', dependsOn: ['AARPGPlayerCharacter'] },
    { featureName: 'WASD movement', category: 'Movement', description: 'Camera-relative movement with orient-to-movement rotation', dependsOn: ['AARPGPlayerController', 'Isometric camera'] },
    { featureName: 'Sprint system', category: 'Movement', description: 'Hold-to-sprint with speed boost, stamina drain, camera FOV shift', dependsOn: ['WASD movement'] },
    { featureName: 'Dodge/dash', category: 'Movement', description: 'Dodge roll with invulnerability, cooldown, stamina cost', dependsOn: ['WASD movement'] },
    { featureName: 'AARPGGameMode', category: 'Framework', description: 'GameMode with correct default pawn and controller', dependsOn: ['AARPGPlayerCharacter', 'AARPGPlayerController'] },
    { featureName: 'UARPGGameInstance', category: 'Framework', description: 'Persistent cross-level data storage' },
  ],
  'arpg-animation': [
    { featureName: 'UARPGAnimInstance', category: 'AnimBP', description: 'C++ AnimInstance with Speed, Direction, IsInAir variables', dependsOn: ['arpg-character::AARPGCharacterBase'] },
    { featureName: 'Locomotion Blend Space', category: 'AnimBP', description: '1D Blend Space for Idle/Walk/Run — can be created headlessly via UCommandlet (BlendParameters set via FProperty reflection)', dependsOn: ['UARPGAnimInstance'] },
    { featureName: 'Animation state machine', category: 'AnimBP', description: 'States: Locomotion, Attacking, Dodging, HitReact, Death. Note: AnimBP graph cannot be created programmatically — requires editor', dependsOn: ['Locomotion Blend Space'] },
    { featureName: 'Attack montages', category: 'Montages', description: '3-hit melee combo montage with sections — fully automatable via commandlet (CompositeSections + NextSectionName linking)', dependsOn: ['Animation state machine'] },
    { featureName: 'Anim Notify classes', category: 'Notifies', description: 'ComboWindow, HitDetection, SpawnVFX, PlaySound notifies', dependsOn: ['Attack montages'] },
    { featureName: 'Motion Warping', category: 'Montages', description: 'MotionWarpingComponent for attack magnetism', dependsOn: ['Attack montages'] },
    { featureName: 'Root motion toggle', category: 'AnimBP', description: 'Root motion on for attacks/dodge, off for locomotion', dependsOn: ['Animation state machine'] },
    { featureName: 'Mixamo import & retarget pipeline', category: 'Retarget', description: 'Mixamo FBX import with bone prefix stripping, IK Retargeter Python API for batch retargeting (auto_map_chains FUZZY + duplicate_and_retarget), root motion extraction via RootMotionGeneratorOp for in-place anims', dependsOn: ['UARPGAnimInstance'] },
    { featureName: 'Asset automation commandlet', category: 'Automation', description: 'PoFEditor module with UAnimAssetCommandlet: headless creation of BS1D, montage shells (combo/dodge/hitreact/death). Run: UnrealEditor-Cmd -run=AnimAsset. Verified on UE 5.7.3 — 8 assets in 0.06s', dependsOn: ['UARPGAnimInstance'] },
  ],
  'arpg-gas': [
    { featureName: 'AbilitySystemComponent', category: 'Core', description: 'ASC on character base with IAbilitySystemInterface', dependsOn: ['arpg-character::AARPGCharacterBase'] },
    { featureName: 'Core AttributeSet', category: 'Attributes', description: 'Health, Mana, Strength, Dexterity, Intelligence, Armor, AttackPower, CritChance, CritDamage', dependsOn: ['AbilitySystemComponent'] },
    { featureName: 'Gameplay Tags hierarchy', category: 'Tags', description: 'Ability.*, State.*, Damage.*, Input.* tag structure' },
    { featureName: 'Base GameplayAbility', category: 'Abilities', description: 'UARPGGameplayAbility with cost/cooldown/tag checking', dependsOn: ['AbilitySystemComponent', 'Gameplay Tags hierarchy'] },
    { featureName: 'Core Gameplay Effects', category: 'Effects', description: 'GE_Damage, GE_Heal, GE_Buff, GE_Regen', dependsOn: ['Core AttributeSet', 'Gameplay Tags hierarchy'] },
    { featureName: 'Damage execution calculation', category: 'Effects', description: 'UARPGDamageExecution with armor/crit formula', dependsOn: ['Core Gameplay Effects', 'Core AttributeSet'] },
    { featureName: 'Default attribute initialization', category: 'Attributes', description: 'Curve/Data Table for base attribute values per level', dependsOn: ['Core AttributeSet'] },
  ],
  'arpg-combat': [
    { featureName: 'Melee attack ability', category: 'Abilities', description: 'GA_MeleeAttack with montage and combo support', dependsOn: ['arpg-gas::Base GameplayAbility', 'arpg-animation::Attack montages'] },
    { featureName: 'Combo system', category: 'Combat', description: 'Combo count tracking, montage section advancement, timeout reset', dependsOn: ['Melee attack ability', 'arpg-animation::Anim Notify classes'] },
    { featureName: 'Hit detection', category: 'Combat', description: 'Weapon trace during anim notify window with TSet dedup', dependsOn: ['arpg-animation::Anim Notify classes'] },
    { featureName: 'GAS damage application', category: 'Combat', description: 'FGameplayEffectSpec creation and application on hit', dependsOn: ['Hit detection', 'arpg-gas::Damage execution calculation'] },
    { featureName: 'Hit reaction system', category: 'Feedback', description: 'Hit react montage, hitstop, camera shake, VFX', dependsOn: ['GAS damage application', 'arpg-animation::Animation state machine'] },
    { featureName: 'Dodge ability (GAS)', category: 'Abilities', description: 'GA_Dodge with State.Invulnerable tag and root motion', dependsOn: ['arpg-gas::Base GameplayAbility', 'arpg-character::Dodge/dash', 'arpg-animation::Root motion toggle'] },
    { featureName: 'Death flow', category: 'Combat', description: 'Health <= 0 triggers State.Dead, death montage, input disable', dependsOn: ['arpg-gas::Core AttributeSet', 'arpg-animation::Animation state machine'] },
    { featureName: 'Combat feedback', category: 'Feedback', description: 'Camera shake, hitstop, hit VFX, floating damage numbers', dependsOn: ['GAS damage application'] },
  ],
  'arpg-enemy-ai': [
    { featureName: 'AARPGAIController', category: 'AI', description: 'AIController with behavior tree, blackboard, perception' },
    { featureName: 'AARPGEnemyCharacter', category: 'Character', description: 'Enemy base with own ASC, attributes, health bar widget', dependsOn: ['arpg-character::AARPGCharacterBase', 'arpg-gas::AbilitySystemComponent', 'arpg-gas::Core AttributeSet'] },
    { featureName: 'AI Perception', category: 'AI', description: 'Sight and damage perception senses configured', dependsOn: ['AARPGAIController'] },
    { featureName: 'Behavior Tree', category: 'AI', description: 'BT with Idle, Patrol, Chase, Attack states', dependsOn: ['AARPGAIController', 'AI Perception'] },
    { featureName: 'EQS queries', category: 'AI', description: 'FindPatrolPoint, FindAttackPosition, FindFlankPosition', dependsOn: ['Behavior Tree'] },
    { featureName: 'Enemy archetypes', category: 'Enemies', description: 'Melee Grunt, Ranged Caster, Brute variants', dependsOn: ['AARPGEnemyCharacter', 'Behavior Tree'] },
    { featureName: 'Enemy Gameplay Abilities', category: 'Abilities', description: 'GA_EnemyMeleeAttack, GA_EnemyRangedAttack, GA_EnemyChargeAttack', dependsOn: ['arpg-gas::Base GameplayAbility', 'Enemy archetypes'] },
    { featureName: 'Spawn system', category: 'Spawning', description: 'Spawn points, wave spawning, difficulty scaling', dependsOn: ['Enemy archetypes'] },
  ],
  'arpg-inventory': [
    { featureName: 'UARPGItemDefinition', category: 'Data', description: 'PrimaryDataAsset with name, icon, type, rarity, effects' },
    { featureName: 'UARPGItemInstance', category: 'Runtime', description: 'Runtime object with definition ref, stack count, affixes', dependsOn: ['UARPGItemDefinition'] },
    { featureName: 'UARPGInventoryComponent', category: 'Component', description: 'Add/Remove/Move/Sort/Find operations with max slots', dependsOn: ['UARPGItemInstance'] },
    { featureName: 'Equipment slot system', category: 'Equipment', description: 'EEquipmentSlot enum with TMap for equipped items', dependsOn: ['UARPGInventoryComponent'] },
    { featureName: 'Equip/unequip GAS flow', category: 'Equipment', description: 'Apply/remove infinite-duration GE on equip/unequip', dependsOn: ['Equipment slot system', 'arpg-gas::Core Gameplay Effects'] },
    { featureName: 'Consumable usage', category: 'Items', description: 'Use consumable applies OnUseEffect, decrement stack', dependsOn: ['UARPGInventoryComponent', 'arpg-gas::Core Gameplay Effects'] },
    { featureName: 'Affix system', category: 'Items', description: 'Rarity tiers with random affix rolling', dependsOn: ['UARPGItemInstance'] },
  ],
  'arpg-loot': [
    { featureName: 'UARPGLootTable', category: 'Data', description: 'Data asset with weighted item entries and rarity ranges', dependsOn: ['arpg-inventory::UARPGItemDefinition'] },
    { featureName: 'Weighted random selection', category: 'Logic', description: 'Drop rolling algorithm with weight normalization', dependsOn: ['UARPGLootTable'] },
    { featureName: 'AARPGWorldItem', category: 'Actors', description: 'Dropped item actor with mesh, nameplate, rarity beam', dependsOn: ['arpg-inventory::UARPGItemInstance'] },
    { featureName: 'Loot drop on death', category: 'Logic', description: 'Roll loot table on enemy death, spawn world items', dependsOn: ['Weighted random selection', 'AARPGWorldItem', 'arpg-combat::Death flow'] },
    { featureName: 'Item pickup', category: 'Logic', description: 'Overlap/interact pickup, inventory full check', dependsOn: ['AARPGWorldItem', 'arpg-inventory::UARPGInventoryComponent'] },
    { featureName: 'Loot visual feedback', category: 'VFX', description: 'Color-coded nameplates, rarity beams, pickup notifications', dependsOn: ['AARPGWorldItem'] },
    { featureName: 'Chest/container actors', category: 'Actors', description: 'Interactive chests with loot tables and open animation', dependsOn: ['Weighted random selection'] },
  ],
  'arpg-ui': [
    { featureName: 'Main HUD widget', category: 'HUD', description: 'Health/mana bars, ability hotbar, minimap placeholder', dependsOn: ['arpg-gas::Core AttributeSet'] },
    { featureName: 'GAS attribute binding', category: 'HUD', description: 'Real-time health/mana bar updates from attribute delegates', dependsOn: ['Main HUD widget', 'arpg-gas::Core AttributeSet'] },
    { featureName: 'Enemy health bars', category: 'HUD', description: 'Floating UWidgetComponent with fade-in/out behavior', dependsOn: ['arpg-enemy-ai::AARPGEnemyCharacter'] },
    { featureName: 'Ability cooldown UI', category: 'HUD', description: 'Ability slots with icon, cooldown sweep, keybind label', dependsOn: ['Main HUD widget', 'arpg-gas::Base GameplayAbility'] },
    { featureName: 'Inventory screen', category: 'Screens', description: 'Grid inventory with tooltips, drag-and-drop, equipment panel', dependsOn: ['arpg-inventory::UARPGInventoryComponent', 'arpg-inventory::Equipment slot system'] },
    { featureName: 'Character stats screen', category: 'Screens', description: 'All attributes with base + bonus display', dependsOn: ['arpg-gas::Core AttributeSet'] },
    { featureName: 'Floating damage numbers', category: 'Feedback', description: 'Damage text at hit location, colored by type, crit variant', dependsOn: ['arpg-combat::GAS damage application'] },
    { featureName: 'Pause/settings menus', category: 'Screens', description: 'Pause menu with graphics, audio, controls settings' },
  ],
  'arpg-progression': [
    { featureName: 'XP and Level attributes', category: 'Attributes', description: 'CurrentXP, XPToNextLevel, CharacterLevel in AttributeSet', dependsOn: ['arpg-gas::Core AttributeSet'] },
    { featureName: 'XP curve table', category: 'Data', description: 'UCurveTable defining XP required per level' },
    { featureName: 'XP award on enemy death', category: 'Logic', description: 'GameplayEvent on kill, GE_AwardXP application', dependsOn: ['XP and Level attributes', 'arpg-combat::Death flow'] },
    { featureName: 'Level-up detection', category: 'Logic', description: 'XP threshold check, level increment, carry-over, point grants', dependsOn: ['XP and Level attributes', 'XP curve table'] },
    { featureName: 'Active abilities', category: 'Abilities', description: 'Fireball, GroundSlam, DashStrike, WarCry abilities', dependsOn: ['arpg-gas::Base GameplayAbility'] },
    { featureName: 'Ability unlock system', category: 'Progression', description: 'Skill point spending, ability learning and upgrading', dependsOn: ['Level-up detection', 'Active abilities'] },
    { featureName: 'Attribute point allocation', category: 'Progression', description: 'Spend points on Str/Dex/Int, permanent GE application', dependsOn: ['Level-up detection', 'arpg-gas::Core Gameplay Effects'] },
    { featureName: 'Ability loadout', category: 'Progression', description: '4 hotbar slots with ability assignment', dependsOn: ['Active abilities'] },
  ],
  'arpg-world': [
    { featureName: 'Zone layout design', category: 'Design', description: 'Town, Forest (easy), Ruins (medium), Catacombs (hard), Boss Arena' },
    { featureName: 'Blockout levels', category: 'Levels', description: 'Greybox geometry for all zones with proper scale', dependsOn: ['Zone layout design'] },
    { featureName: 'Enemy spawn placement', category: 'Spawning', description: 'Spawn points per zone with enemy types and counts', dependsOn: ['Blockout levels', 'arpg-enemy-ai::Spawn system'] },
    { featureName: 'Interactive world objects', category: 'Actors', description: 'Chests, destructible barrels, doors, NPC interaction points', dependsOn: ['Blockout levels'] },
    { featureName: 'Zone transitions', category: 'Streaming', description: 'Level streaming portals with transition screen', dependsOn: ['Blockout levels'] },
    { featureName: 'Boss encounter', category: 'Boss', description: 'Multi-phase boss with unique BT, boss health bar UI', dependsOn: ['arpg-enemy-ai::Enemy archetypes', 'arpg-ui::Enemy health bars'] },
    { featureName: 'Environmental hazards', category: 'Actors', description: 'Fire floors, poison clouds, spike traps with GE damage', dependsOn: ['Blockout levels', 'arpg-gas::Core Gameplay Effects'] },
    { featureName: 'NavMesh coverage', category: 'Navigation', description: 'NavMesh bounds, AI pathing verified, Nav Modifiers', dependsOn: ['Blockout levels'] },
  ],
  'arpg-save': [
    { featureName: 'UARPGSaveGame', category: 'Core', description: 'USaveGame subclass with all persistent state fields' },
    { featureName: 'Custom serialization', category: 'Core', description: 'Item instances with affixes serialized/deserialized', dependsOn: ['UARPGSaveGame', 'arpg-inventory::UARPGItemInstance'] },
    { featureName: 'Save function', category: 'Logic', description: 'Gather state from ASC, inventory, world into SaveGame', dependsOn: ['UARPGSaveGame', 'arpg-gas::AbilitySystemComponent', 'arpg-inventory::UARPGInventoryComponent'] },
    { featureName: 'Load function', category: 'Logic', description: 'Restore all systems from SaveGame data', dependsOn: ['Save function'] },
    { featureName: 'Auto-save', category: 'Logic', description: 'Save on zone transitions, boss kills, level-ups, timer', dependsOn: ['Save function'] },
    { featureName: 'Save slot system', category: 'UI', description: '3 manual + 1 auto slot with metadata display', dependsOn: ['Save function', 'Load function'] },
    { featureName: 'Save versioning', category: 'Core', description: 'Version field with migration functions', dependsOn: ['UARPGSaveGame'] },
  ],
  'arpg-polish': [
    { featureName: 'Structured logging', category: 'Debug', description: 'Custom log categories per system (Combat, AI, Inventory, etc.)' },
    { featureName: 'Debug draw helpers', category: 'Debug', description: 'Visual debug for traces, AI ranges, spawn points, ability radii' },
    { featureName: 'Debug console commands', category: 'Debug', description: 'God mode, give item, set level, spawn enemy, kill all' },
    { featureName: 'Object pooling', category: 'Performance', description: 'Pool for projectiles, VFX, damage numbers, loot pickups' },
    { featureName: 'Tick optimization', category: 'Performance', description: 'Reduced tick frequency for distant actors, timer usage' },
    { featureName: 'Async asset loading', category: 'Performance', description: 'TSoftObjectPtr for icons, meshes, VFX with FStreamableManager' },
  ],

  // ─── Content Modules ────────────────────────────────────────────────────────

  'models': [
    { featureName: 'Static mesh import pipeline', category: 'Import', description: 'FBX/glTF import settings, scale, pivot, material assignment' },
    { featureName: 'LOD generation', category: 'Optimization', description: 'Auto LOD groups with screen-size thresholds and reduction settings' },
    { featureName: 'Collision setup', category: 'Physics', description: 'Simple/complex collision, UCX convex hulls, per-poly collision toggle', dependsOn: ['Static mesh import pipeline'] },
    { featureName: 'Nanite mesh enabling', category: 'Optimization', description: 'Nanite enable per mesh, fallback LOD settings, displacement', dependsOn: ['Static mesh import pipeline'] },
    { featureName: 'Nanite Foliage setup', category: 'Optimization', description: 'Nanite Assemblies for dense foliage, Nanite Skinning for dynamic wind via Dynamic Wind plugin, USD importer with DCC markup schemas (5.7+)', dependsOn: ['Nanite mesh enabling'] },
    { featureName: 'Data Table mesh registry', category: 'Data', description: 'FDataTableRowHandle entries for mesh catalogs with metadata', dependsOn: ['Static mesh import pipeline'] },
    { featureName: 'Procedural mesh generation', category: 'Runtime', description: 'UProceduralMeshComponent with vertex/triangle/UV construction' },
    { featureName: 'Skeletal mesh import', category: 'Import', description: 'Skeletal mesh with skeleton asset, physics asset, retargeting setup' },
  ],
  'animations': [
    { featureName: 'Custom AnimInstance base', category: 'AnimBP', description: 'C++ UAnimInstance subclass with NativeUpdateAnimation and proxy variables' },
    { featureName: 'Blend Space setup', category: 'AnimBP', description: '1D/2D Blend Spaces for locomotion with axis parameters', dependsOn: ['Custom AnimInstance base'] },
    { featureName: 'Animation state machine', category: 'AnimBP', description: 'State machine with transition rules, automatic/conditional states', dependsOn: ['Blend Space setup'] },
    { featureName: 'Montage system', category: 'Montages', description: 'Animation montages with sections, blend-in/out, slots', dependsOn: ['Custom AnimInstance base'] },
    { featureName: 'Anim Notify framework', category: 'Notifies', description: 'UAnimNotify and UAnimNotifyState subclasses for gameplay events', dependsOn: ['Montage system'] },
    { featureName: 'Motion Warping setup', category: 'Warping', description: 'UMotionWarpingComponent with warp targets and update methods', dependsOn: ['Montage system'] },
    { featureName: 'Root motion configuration', category: 'AnimBP', description: 'Root motion enable/disable per state, extract/ignore settings', dependsOn: ['Animation state machine'] },
    { featureName: 'Animation retargeting', category: 'Retarget', description: 'IK Retargeter setup with IK Rig for cross-skeleton sharing. Python API: IKRetargeterController for scriptable setup, auto_map_chains(FUZZY) for Mixamo→UE5 bone mapping, IKRetargetBatchOperation.duplicate_and_retarget() for bulk retargeting. 5.7+: crotch height, floor constraints, stretch chain operators, spatially aware retargeting with collision prevention', dependsOn: ['Custom AnimInstance base'] },
    { featureName: 'Motion Matching', category: 'AnimBP', description: 'Motion Matching Chooser Integration for per-asset filtering (5.7+ experimental). Data-driven animation selection from motion database', dependsOn: ['Custom AnimInstance base', 'Blend Space setup'] },
    { featureName: 'Blendshape sculpting', category: 'Morph', description: 'Skeletal Editor blendshape and sculpting tools for morph targets with topology-adaptive shapes (5.7+)', dependsOn: ['Custom AnimInstance base'] },
    { featureName: 'Editor Commandlet automation', category: 'Automation', description: 'UCommandlet-based headless asset creation: blend spaces (via FProperty reflection on protected BlendParameters), montages (NewObject + CompositeSections + SavePackage), tested on UE 5.7.3. PoFEditor module pattern with separate Build.cs depending on UnrealEd + AssetTools. ~0.06s for 8 assets.', dependsOn: ['Custom AnimInstance base', 'Montage system'] },
  ],
  'materials': [
    { featureName: 'Master material', category: 'Core', description: 'Layered master material with static switch parameters for variants' },
    { featureName: 'Dynamic material instances', category: 'Runtime', description: 'UMaterialInstanceDynamic creation and scalar/vector parameter updates', dependsOn: ['Master material'] },
    { featureName: 'Material Parameter Collection', category: 'Global', description: 'MPC for global parameters (time, wind, weather) accessible across materials' },
    { featureName: 'Material functions library', category: 'Functions', description: 'Reusable material functions for UV manipulation, blending, noise' },
    { featureName: 'Post-process materials', category: 'PostProcess', description: 'Post-process material chain with scene texture sampling and blendables', dependsOn: ['Material functions library'] },
    { featureName: 'HLSL custom nodes', category: 'Custom', description: 'Custom HLSL expressions for specialized shading, SDF, ray marching' },
    { featureName: 'Material layer system', category: 'Layers', description: 'Material Layer and Material Layer Blend for modular surface composition', dependsOn: ['Master material'] },
    { featureName: 'Substrate shading models', category: 'Core', description: 'Substrate (production-ready 5.7+): unified shading model replacing legacy Default Lit/Subsurface/Cloth. Use Substrate Slab for PBR, eye, cloth, thin-film, and clearcoat via a single flexible material graph', dependsOn: ['Master material'] },
  ],
  'level-design': [
    { featureName: 'Blockout geometry', category: 'Layout', description: 'BSP/geometry brush blockout with proper scale reference and metric grids' },
    { featureName: 'Spawn point placement', category: 'Spawning', description: 'APlayerStart and custom spawn point actors with team/mode filtering', dependsOn: ['Blockout geometry'] },
    { featureName: 'Level streaming setup', category: 'Streaming', description: 'World Partition or Level Streaming Volumes with loading/unloading triggers', dependsOn: ['Blockout geometry'] },
    { featureName: 'Zone transition system', category: 'Streaming', description: 'Level transition triggers with seamless travel or loading screen', dependsOn: ['Level streaming setup'] },
    { featureName: 'Environmental hazards', category: 'Gameplay', description: 'Damage volumes, moving platforms, trap triggers, area effects', dependsOn: ['Blockout geometry'] },
    { featureName: 'NavMesh configuration', category: 'Navigation', description: 'RecastNavMesh bounds, Nav Modifiers, Nav Links for AI pathfinding', dependsOn: ['Blockout geometry'] },
    { featureName: 'Procedural level generation', category: 'Procedural', description: 'Room/tile-based procedural layout with PCG framework integration', dependsOn: ['Blockout geometry'] },
    { featureName: 'PCG graph setup', category: 'Procedural', description: 'PCG graphs for content generation: scatter, spline-based placement, attribute-driven filtering. GPU Fast Geo Interop for large-scale generation (5.7+ production-ready)', dependsOn: ['Blockout geometry'] },
    { featureName: 'Procedural Vegetation (PVE)', category: 'Procedural', description: 'Procedural Vegetation Editor for biome painting with density, slope, altitude rules. Integrates with Nanite Foliage assemblies (5.7+)', dependsOn: ['PCG graph setup'] },
  ],
  'ui-hud': [
    { featureName: 'Main menu widget', category: 'Menus', description: 'UMG main menu with New Game, Continue, Settings, Quit buttons' },
    { featureName: 'HUD framework', category: 'HUD', description: 'AHUD subclass with UMG overlay, widget management, show/hide logic' },
    { featureName: 'Inventory screen', category: 'Screens', description: 'Grid-based inventory UI with drag-drop, tooltips, item slots', dependsOn: ['HUD framework'] },
    { featureName: 'Settings menu', category: 'Menus', description: 'UGameUserSettings integration with graphics, audio, controls tabs', dependsOn: ['Main menu widget'] },
    { featureName: 'Floating damage numbers', category: 'Feedback', description: 'UWidgetComponent damage text with color coding, animation, pooling', dependsOn: ['HUD framework'] },
    { featureName: 'Loading screen', category: 'Screens', description: 'ILoadingScreenModule with progress bar, tips, async level load', dependsOn: ['Main menu widget'] },
    { featureName: 'Widget animation system', category: 'Animation', description: 'UMG animations for fade, slide, scale with sequencer curves', dependsOn: ['HUD framework'] },
  ],
  'audio': [
    { featureName: 'Sound manager subsystem', category: 'Core', description: 'UGameInstanceSubsystem for centralized sound playback and volume control' },
    { featureName: 'Ambient sound system', category: 'Ambient', description: 'AAmbientSound actors with attenuation, occlusion, and spatialization', dependsOn: ['Sound manager subsystem'] },
    { featureName: 'Dynamic music system', category: 'Music', description: 'Layered music with intensity transitions, combat/explore states', dependsOn: ['Sound manager subsystem'] },
    { featureName: 'Audio volumes and reverb', category: 'Spatial', description: 'AAudioVolume with reverb presets, interior/exterior zones' },
    { featureName: 'MetaSounds integration', category: 'MetaSounds', description: 'MetaSound source patches for procedural audio, parameter interfaces', dependsOn: ['Sound manager subsystem'] },
    { featureName: 'Sound concurrency settings', category: 'Optimization', description: 'USoundConcurrency with max count, priority, volume scaling rules', dependsOn: ['Sound manager subsystem'] },
  ],

  // ─── Game Systems Modules ───────────────────────────────────────────────────

  'physics': [
    { featureName: 'Collision profiles and channels', category: 'Collision', description: 'Custom ECollisionChannel, collision profiles, preset configurations' },
    { featureName: 'Physics materials', category: 'Materials', description: 'UPhysicalMaterial with friction, restitution, surface type for impacts' },
    { featureName: 'Projectile system', category: 'Projectiles', description: 'UProjectileMovementComponent setup with velocity, gravity, homing', dependsOn: ['Collision profiles and channels'] },
    { featureName: 'Chaos destruction', category: 'Destruction', description: 'Geometry Collection with fracture, damage thresholds, field system', dependsOn: ['Collision profiles and channels', 'Physics materials'] },
    { featureName: 'Physics constraints', category: 'Constraints', description: 'UPhysicsConstraintComponent for joints, hinges, ragdoll setup' },
    { featureName: 'Trace utilities', category: 'Traces', description: 'Line/sphere/box trace helpers with channel filtering and debug draw', dependsOn: ['Collision profiles and channels'] },
  ],
  'multiplayer': [
    { featureName: 'Replicated properties', category: 'Replication', description: 'UPROPERTY(Replicated) with GetLifetimeReplicatedProps and conditions' },
    { featureName: 'RPC framework', category: 'Replication', description: 'Server/Client/Multicast RPCs with reliable/unreliable and validation', dependsOn: ['Replicated properties'] },
    { featureName: 'GameState replication', category: 'Framework', description: 'AGameStateBase with replicated match state, scores, player array', dependsOn: ['Replicated properties'] },
    { featureName: 'Session management', category: 'Sessions', description: 'UOnlineSessionInterface with create/find/join/destroy session flow' },
    { featureName: 'Network prediction', category: 'Movement', description: 'Client-side prediction, server reconciliation, CharacterMovement replication', dependsOn: ['Replicated properties', 'RPC framework'] },
    { featureName: 'Net relevancy settings', category: 'Optimization', description: 'AActor::IsNetRelevantFor, NetCullDistanceSquared, dormancy configuration', dependsOn: ['Replicated properties'] },
    { featureName: 'Iris replication system', category: 'Replication', description: 'Iris replication (5.7+ beta): StartActorReplication API replacing UReplicationBridge, OnBeginReplication override for per-actor config, StartReplicationParams for initial state', dependsOn: ['Replicated properties', 'RPC framework'] },
  ],
  'save-load': [
    { featureName: 'USaveGame subclass', category: 'Core', description: 'USaveGame with UPROPERTY fields for all persistent game state' },
    { featureName: 'Save and load functions', category: 'Logic', description: 'UGameplayStatics::SaveGameToSlot/LoadGameFromSlot with async variants', dependsOn: ['USaveGame subclass'] },
    { featureName: 'Auto-save system', category: 'Logic', description: 'Timer-based and event-triggered auto-save with throttling', dependsOn: ['Save and load functions'] },
    { featureName: 'Save slot UI', category: 'UI', description: 'Save/Load screen with slot list, metadata preview, delete confirmation', dependsOn: ['Save and load functions'] },
    { featureName: 'Save versioning', category: 'Migration', description: 'Version field with migration path for backward compatibility', dependsOn: ['USaveGame subclass'] },
    { featureName: 'Custom serialization', category: 'Serialization', description: 'FArchive-based custom serialize for complex objects and containers', dependsOn: ['USaveGame subclass'] },
  ],
  'input-handling': [
    { featureName: 'Enhanced Input actions', category: 'Actions', description: 'UInputAction assets for Move, Look, Jump, Interact, Attack with value types' },
    { featureName: 'Input Mapping Context setup', category: 'Mapping', description: 'UInputMappingContext with key bindings, modifiers, and triggers', dependsOn: ['Enhanced Input actions'] },
    { featureName: 'Key rebinding system', category: 'Settings', description: 'Runtime key rebinding with UEnhancedInputUserSettings and save/load', dependsOn: ['Input Mapping Context setup'] },
    { featureName: 'Gamepad support', category: 'Devices', description: 'Gamepad bindings, deadzone config, platform-specific glyph display', dependsOn: ['Input Mapping Context setup'] },
    { featureName: 'Input mode management', category: 'Modes', description: 'Game-only, UI-only, Game+UI input modes with cursor show/hide', dependsOn: ['Enhanced Input actions'] },
    { featureName: 'Context-sensitive input', category: 'Contexts', description: 'IMC stacking/swapping for vehicle, swimming, menu contexts', dependsOn: ['Input Mapping Context setup'] },
  ],
  'dialogue-quests': [
    { featureName: 'Dialogue data asset', category: 'Data', description: 'UPrimaryDataAsset for dialogue trees with speaker, text, conditions' },
    { featureName: 'Branching conversation system', category: 'Dialogue', description: 'Dialogue UI with player choices, condition checks, consequence triggers', dependsOn: ['Dialogue data asset'] },
    { featureName: 'Quest tracker', category: 'Quests', description: 'UQuestSubsystem managing active/completed quests with state machine' },
    { featureName: 'Quest objectives', category: 'Quests', description: 'Objective types: kill, collect, interact, reach location with progress', dependsOn: ['Quest tracker'] },
    { featureName: 'NPC interaction system', category: 'Interaction', description: 'Interact trigger, NPC dialogue entry point, shop/quest giver roles', dependsOn: ['Dialogue data asset'] },
    { featureName: 'Quest log UI', category: 'UI', description: 'Quest log widget with active/completed tabs, objective checklist, rewards', dependsOn: ['Quest tracker', 'Quest objectives'] },
  ],
  'ai-behavior': [
    { featureName: 'AI Controller base', category: 'Controller', description: 'AAIController subclass with blackboard initialization and possession logic' },
    { featureName: 'Behavior Tree system', category: 'BehaviorTree', description: 'UBehaviorTree with BTTask, BTService, BTDecorator custom nodes', dependsOn: ['AI Controller base'] },
    { featureName: 'AI Perception setup', category: 'Perception', description: 'UAIPerceptionComponent with sight, hearing, damage senses', dependsOn: ['AI Controller base'] },
    { featureName: 'EQS queries', category: 'EQS', description: 'UEnvQueryManager with custom generators, tests, contexts', dependsOn: ['Behavior Tree system'] },
    { featureName: 'Group AI coordination', category: 'Coordination', description: 'Squad manager for flanking, surround, focus-fire, retreat behaviors', dependsOn: ['Behavior Tree system', 'AI Perception setup'] },
    { featureName: 'AI debugging tools', category: 'Debug', description: 'Gameplay Debugger categories, visual logger, BT debugger integration', dependsOn: ['Behavior Tree system'] },
    { featureName: 'State Tree AI system', category: 'StateTree', description: 'State Tree as modern alternative to Behavior Trees (5.7+): hierarchical states with ExecutionRuntimeData for persistent node data, Re-Enter State behavior, Output Properties for Live Property Binding, Rewind Debugger integration', dependsOn: ['AI Controller base'] },
  ],
  'packaging': [
    { featureName: 'Build configuration', category: 'Config', description: 'Development/Shipping build targets with UBT settings and defines' },
    { featureName: 'Cooking settings', category: 'Cook', description: 'Asset cooking rules, texture compression, shader permutations per platform' },
    { featureName: 'Platform configuration', category: 'Platform', description: 'Target platform settings: Win64, console SDK, mobile with per-platform overrides', dependsOn: ['Build configuration'] },
    { featureName: 'Build automation', category: 'Automation', description: 'UAT BuildCookRun commands, CI/CD pipeline scripts, build farm setup', dependsOn: ['Build configuration', 'Cooking settings'] },
    { featureName: 'Version numbering system', category: 'Versioning', description: 'UpdateBuildVersion with FEngineVersion, build metadata in config', dependsOn: ['Build configuration'] },
    { featureName: 'Content validation', category: 'Validation', description: 'Asset audit commandlet, reference viewer checks, cook error reporting', dependsOn: ['Cooking settings'] },
  ],
};

// ─── Dependency resolution engine ─────────────────────────────────────────────

export interface ResolvedDependency {
  moduleId: SubModuleId;
  featureName: string;
  /** Fully qualified key: "moduleId::featureName" */
  key: string;
}

export interface DependencyInfo {
  /** Direct dependencies for this feature */
  deps: ResolvedDependency[];
  /** Full transitive chain (breadth-first) */
  chain: ResolvedDependency[];
  /** Dependencies that are NOT implemented (status != 'implemented') */
  blockers: ResolvedDependency[];
  /** True if any upstream dependency is missing/unknown */
  isBlocked: boolean;
}

/** Resolve a dependency reference like "featureName" or "moduleId::featureName" */
function resolveDep(ref: string, contextModuleId: string): ResolvedDependency {
  if (ref.includes('::')) {
    const [mod, feat] = ref.split('::', 2);
    return { moduleId: mod as SubModuleId, featureName: feat, key: `${mod}::${feat}` };
  }
  return { moduleId: contextModuleId as SubModuleId, featureName: ref, key: `${contextModuleId}::${ref}` };
}

/**
 * Build a full dependency map for all features across all modules.
 *
 * Memoized: MODULE_FEATURE_DEFINITIONS is a static const, so deps and
 * transitive chains are computed once and reused. The cached map should
 * be treated as read-only — use computeBlockers() to get a status-aware copy.
 */
let _cachedDepMap: Map<string, DependencyInfo> | null = null;

export function buildDependencyMap(): Map<string, DependencyInfo> {
  if (_cachedDepMap) return _cachedDepMap;

  const map = new Map<string, DependencyInfo>();

  // First pass: resolve direct deps
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      const deps = (feat.dependsOn ?? []).map((ref) => resolveDep(ref, moduleId));
      map.set(key, { deps, chain: [], blockers: [], isBlocked: false });
    }
  }

  // Second pass: compute transitive chains (BFS)
  for (const [key, info] of map) {
    const visited = new Set<string>([key]);
    const queue = [...info.deps];
    const chain: ResolvedDependency[] = [];

    while (queue.length > 0) {
      const dep = queue.shift()!;
      if (visited.has(dep.key)) continue;
      visited.add(dep.key);
      chain.push(dep);
      const upstream = map.get(dep.key);
      if (upstream) {
        for (const d of upstream.deps) {
          if (!visited.has(d.key)) queue.push(d);
        }
      }
    }

    info.chain = chain;
  }

  _cachedDepMap = map;
  return map;
}

/**
 * Given a status map (featureKey → status), compute blockers for each feature.
 *
 * Returns a NEW map with shallow-copied entries so the memoized base map is
 * not mutated. Multiple callers with different statusMaps won't conflict.
 */
export function computeBlockers(
  depMap: Map<string, DependencyInfo>,
  statusMap: Map<string, string>,
): Map<string, DependencyInfo> {
  const result = new Map<string, DependencyInfo>();
  for (const [key, info] of depMap) {
    const blockers = info.deps.filter((d) => {
      const status = statusMap.get(d.key);
      return !status || status !== 'implemented';
    });
    result.set(key, {
      ...info,
      blockers,
      isBlocked: blockers.length > 0,
    });
  }
  return result;
}
