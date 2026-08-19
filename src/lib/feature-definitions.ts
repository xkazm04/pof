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

  // Visual Generation (Asset Studio)
  'asset-viewer': [],
  'asset-forge': ['asset-viewer'],
  'material-lab': ['asset-viewer'],
  'blender-pipeline': [],
  'asset-browser': [],
  'import-automation': ['asset-viewer', 'blender-pipeline'],
  'auto-rig': ['asset-viewer'],
  'procedural-engine': ['asset-viewer'],
  'scene-composer': ['asset-viewer', 'blender-pipeline'],
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
  completed: number;
  total: number;
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
    let completed = 0;
    let pct = 0;
    if (progress && total > 0) {
      completed = Object.values(progress).filter(Boolean).length;
      pct = Math.round((completed / total) * 100);
    }
    if (pct < 50) {
      unmet.push({ moduleId: prereqId, label: prereqId, progress: pct, completed, total });
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

  // ─── Visual Generation (Asset Studio) ───────────────────────────────────────
  //
  // Unlike the modules above — whose features are UE5 C++ classes the scan looks
  // for in the game project — the nine Asset Studio modules are surfaces of the
  // PoF app itself. Their features are therefore named after the app artifacts
  // that implement them: a component that renders, a Zustand store, a pure lib
  // function, an API route. Each name below was read off the code on 2026-08-18;
  // nothing is declared that could not be pointed at.

  'asset-viewer': [
    { featureName: 'SceneViewer canvas', category: 'Viewport', description: 'react-three-fiber Canvas host (asset-viewer/SceneViewer.tsx) with a Suspense boundary, auto-centred model mount and an empty-scene placeholder' },
    { featureName: 'Model file loader', category: 'Loading', description: 'GLTFLoader-backed LoadedModel plus the ViewerToolbar file picker (.glb/.gltf/.fbx) handing an object URL to useViewerStore.setModel', dependsOn: ['SceneViewer canvas'] },
    { featureName: 'Orbit controls', category: 'Camera', description: 'drei OrbitControls with damping, zoom clamps and the auto-rotate toggle held in useViewerStore', dependsOn: ['SceneViewer canvas'] },
    { featureName: 'Three-point scene lighting', category: 'Lighting', description: 'Ambient base plus key/fill/rim directional lights and a drei Environment studio preset for reflections', dependsOn: ['SceneViewer canvas'] },
    { featureName: 'Render mode switching', category: 'Rendering', description: 'textured / solid / wireframe RenderMode applied by traversing the loaded scene and swapping materials, with the originals restored on change', dependsOn: ['Model file loader'] },
    { featureName: 'Grid and axis gizmo', category: 'Reference', description: 'drei Grid ground plane and the GizmoHelper/GizmoViewport orientation cube, each toggled from useViewerStore', dependsOn: ['SceneViewer canvas'] },
    { featureName: 'Viewport screenshot export', category: 'Export', description: 'canvas.toDataURL PNG capture downloaded as <model>_<timestamp>.png from AssetViewerView', dependsOn: ['SceneViewer canvas'] },
    // Was: "graded against the UE5_PRESETS budgets in the AssetInspector panel". Both
    // are gone (2026-08-19). AssetInspector had zero importers outside its own folder —
    // this line was its only reference anywhere — and UE5_PRESETS was a rival budget
    // table contradicting polycount-presets by up to 10x. The grading that ships now runs
    // through the project's authored authorities and is mounted on the /3d studio rail.
    { featureName: 'Asset stats and budget inspector', category: 'Inspection', description: 'computeAssetStats (triangles, vertices, material slots, textures, animations) graded by gradeViewerAsset (asset-viewer/assetGrade.ts) through polycount-presets + face-budget + world-scale, rendered by StudioInspector on the /3d studio rail; asset class is a stated input and an unstated one grades unmeasured', dependsOn: ['Model file loader'] },
  ],
  'asset-forge': [
    { featureName: 'Generation provider registry', category: 'Providers', description: 'GENERATION_PROVIDERS (lib/visual-gen/providers.ts) filtered per generation mode, splitting MCP-dispatched from runner-backed providers' },
    { featureName: 'Prompt chip builder', category: 'Prompting', description: 'composeVisualPrompt over the PromptBuilder chip set, with a raw-prompt override and recallable prompt history in useForgeStore' },
    { featureName: 'Text-to-3D generation', category: 'Generation', description: 'text-to-3d submit path in GenerationPanel dispatching useForgeStore.submitMcpJob against the selected provider', dependsOn: ['Generation provider registry', 'Prompt chip builder'] },
    { featureName: 'Image-to-3D generation', category: 'Generation', description: 'image-to-3d mode: reference image read as a data URL and submitted through submitLocalJob for runner-backed providers', dependsOn: ['Generation provider registry'] },
    { featureName: 'Generation job queue', category: 'Queue', description: 'useForgeStore job list (pending/generating/importing/completed/failed) with progress, retry, cancel and clear-completed, rendered by GenerationQueue', dependsOn: ['Text-to-3D generation'] },
    { featureName: 'Job status polling', category: 'Queue', description: 'bounded polling of /api/visual-gen/generate/status capped by FORGE_POLL_MAX_DURATION_MS, with per-job stop handles', dependsOn: ['Generation job queue'] },
    { featureName: 'Style DNA profiles', category: 'Style', description: 'StyleDnaPanel over style-dna-db and /api/visual-gen/style-dna; the active profile fragment is appended to the submitted prompt', dependsOn: ['Prompt chip builder'] },
    { featureName: 'Mesh critique gate', category: 'Quality', description: 'parseCritiqueMetrics / classifyComponents geometry verdict surfaced per job by CritiqueBadge (verdict, score, fidelity)', dependsOn: ['Generation job queue'] },
    { featureName: 'Generated mesh gallery', category: 'Output', description: 'generated meshes persisted under every dir in the ASSET_DIRS allow-list (triposr, tripo3d, hunyuan3d, mesh-finish, meshes) and listed/served by /api/visual-gen/assets and /api/visual-gen/asset/[name]?dir= (buildMultiDirAssetList + safeAssetName/safeAssetDir allow-lists)', dependsOn: ['Generation job queue'] },
  ],
  'material-lab': [
    { featureName: 'PBR parameter editor', category: 'Editor', description: 'PBREditor base-colour picker plus metallic / roughness / normal-strength / AO sliders bound to the useMaterialStore PBRParams' },
    { featureName: 'Built-in material presets', category: 'Presets', description: 'BUILT_IN_PRESETS quick-apply swatches (polished metal, rough stone, wood, plastic, gold, rubber) in PBREditor', dependsOn: ['PBR parameter editor'] },
    { featureName: 'Texture channel slots', category: 'Textures', description: 'albedo / normal / metallic / roughness / AO upload slots with thumbnail, clear and highlight tick in useMaterialStore', dependsOn: ['PBR parameter editor'] },
    { featureName: 'Live PBR preview', category: 'Preview', description: 'MaterialPreview MeshStandardMaterial on a switchable sphere/cube/plane/cylinder under a drei studio Environment, updated from the store in real time', dependsOn: ['PBR parameter editor', 'Texture channel slots'] },
    { featureName: 'Material preset store', category: 'Presets', description: 'useMaterialStore loadPresets / addPreset / loadPreset / removePreset backed by the saved-material API, surfaced by MaterialPresetList with an InlineErrorRetry on any failed load, save or delete', dependsOn: ['PBR parameter editor'] },
    { featureName: 'Saved material API', category: 'Persistence', description: 'SQLite-backed material records (createMaterial / listMaterials / updateMaterial / deleteMaterial) behind /api/visual-gen/materials, read on lab mount and written on every preset save so a preset survives a reload', dependsOn: ['Material preset store'] },
    { featureName: 'Send material to Blender', category: 'Bridge', description: 'useMaterialStore.sendToBlender emits createMaterialScript through /api/blender-mcp/execute, carrying every scalar plus each resolvable texture channel, and returns the transfer plan so the UI names what did not travel', dependsOn: ['PBR parameter editor'] },
    { featureName: 'UE5 material instance export', category: 'Export', description: 'buildUE5MaterialInstance emits deterministic UE Python creating a MaterialInstanceConstant of the shared M_ARPG_Surface_Master (empty-pin-safe colour wiring, run-time report of parameters the parent does not expose), surfaced by the UE5ExportPanel tab via CodeViewer copy/download', dependsOn: ['PBR parameter editor'] },
    { featureName: 'Advanced texture generation', category: 'Textures', description: 'AdvancedTexturePanel tiles: Scenario seamless PBR set generation with seam-check reroll, plus Leonardo upscale, unzoom, ControlNet and inpaint', dependsOn: ['Texture channel slots'] },
  ],
  'blender-pipeline': [
    { featureName: 'Blender install detection', category: 'Setup', description: 'GET /api/visual-gen/blender/detect probing the known Windows/Linux/macOS install paths and reading `blender --version`' },
    { featureName: 'Blender MCP script runner', category: 'Execution', description: 'ScriptRunner.executeViaMCP posting generated Python to /api/blender-mcp/execute, with the job list, output and status held in useBlenderStore' },
    { featureName: 'FBX to glTF conversion', category: 'Conversion', description: 'convertFbxScript driven by FBXConversionTab — import, apply transforms, triangulate, export GLB', dependsOn: ['Blender MCP script runner'] },
    { featureName: 'LOD generation', category: 'Optimization', description: 'generateLodsScript driven by LODGenerationTab with configurable decimate ratios per LOD level', dependsOn: ['Blender MCP script runner'] },
    { featureName: 'Mesh optimization', category: 'Optimization', description: 'optimizeMeshScript driven by MeshOptimizationTab — merge by distance, recalculate normals, remove loose geometry, smooth shading', dependsOn: ['Blender MCP script runner'] },
    { featureName: 'Blender connection bar', category: 'Setup', description: 'BlenderConnectionBar + ViewportPreview in BlenderSetup: live MCP connection state and captured Blender viewport frames' },
  ],
  'asset-browser': [
    { featureName: 'Poly Haven search', category: 'Sources', description: 'searchPolyHaven (lib/visual-gen/asset-sources.ts) behind GET /api/visual-gen/browse?source=polyhaven with hdris/textures/models category filtering' },
    { featureName: 'ambientCG search', category: 'Sources', description: 'searchAmbientCG over the ambientCG full_json API behind the same /api/visual-gen/browse route' },
    { featureName: 'Sketchfab search', category: 'Sources', description: 'blender-pipeline/AssetBrowser querying /api/blender-mcp/assets for Sketchfab results over the live MCP bridge — NOT part of the CC0 browse route, which serves polyhaven + ambientcg only' },
    { featureName: 'Asset library persistence', category: 'Library', description: 'asset-library-db recordAsset / listLibraryAssets / deleteLibraryAsset behind /api/visual-gen/library, recording source, license and file paths per download', dependsOn: ['Poly Haven search'] },
    { featureName: 'Collections and favourites', category: 'Library', description: 'collection CRUD plus the favourite toggle and LibraryFilter (source / category / favourites / collection / query) driving CollectionSidebar and LibraryPanel', dependsOn: ['Asset library persistence'] },
    { featureName: 'Blender import from results', category: 'Bridge', description: 'useAssetBrowserStore.importToBlender sending a browse or library row into the live Blender session, gated on the MCP connection', dependsOn: ['Poly Haven search'] },
  ],
  'import-automation': [
    { featureName: 'Import configuration form', category: 'Config', description: 'ConfigTab controls for asset name, source format, mesh type, scale, collision, material import, LOD count and UE5 content path, with copy-to-clipboard output' },
    { featureName: 'UE5 import script generator', category: 'Codegen', description: 'generateImportScript (lib/visual-gen/ue5-import-templates.ts) emitting a UEditorUtilityWidget importer wired to UFbxFactory or UGLTFImporterFactory from an ImportConfig', dependsOn: ['Import configuration form'] },
    { featureName: 'UE5 DataAsset generator', category: 'Codegen', description: 'generateDataAsset emitting a UDataAsset subclass cataloguing the imported mesh, material slots, LOD distances and source metadata', dependsOn: ['Import configuration form'] },
  ],
  'auto-rig': [
    { featureName: 'Rig preset library', category: 'Presets', description: 'RIG_PRESETS (UE5 Mannequin, MetaHuman, Minimal Humanoid) with bone counts, IK chain definitions and Mixamo bone mappings, rendered by RigPresetCard' },
    { featureName: 'Mixamo workflow guide', category: 'Guidance', description: 'the step-by-step Mixamo upload/download walkthrough in AutoRigView plus the per-preset Mixamo→target bone mapping table', dependsOn: ['Rig preset library'] },
    { featureName: 'Blender armature creation', category: 'Rigging', description: 'presetToBones + createArmatureScript executed through /api/blender-mcp/execute, reporting per-preset success or error', dependsOn: ['Rig preset library'] },
  ],
  'procedural-engine': [
    { featureName: 'Terrain heightmap generator', category: 'Generators', description: 'generateDiamondSquare over a TerrainConfig (size, roughness, height range, seed) plus heightmapToUint16 for 16-bit export' },
    { featureName: 'Dungeon layout generator', category: 'Generators', description: 'generateDungeon BSP room/corridor/door placement producing a typed DungeonResult cell grid' },
    { featureName: 'Vegetation scatter generator', category: 'Generators', description: 'generateVegetation Poisson-disk scatter over DEFAULT_SPECIES with per-species radius, slope and height constraints' },
    { featureName: 'Generator parameter editors', category: 'UI', description: 'ParameterEditors controls bound to the terrain / dungeon / vegetation configs in useProceduralStore' },
    { featureName: 'Canvas result previews', category: 'Preview', description: 'TerrainPreview, DungeonPreview and VegetationPreview 2D canvas renderers for the generated result', dependsOn: ['Terrain heightmap generator', 'Dungeon layout generator', 'Vegetation scatter generator'] },
    { featureName: 'Blender export bridge', category: 'Export', description: 'exportTerrainToBlender / exportDungeonToBlender / exportVegetationToBlender emitting terrainToMeshScript, dungeonToGeometryScript and scatterVegetationScript through the MCP execute route, with ExportFeedback status', dependsOn: ['Terrain heightmap generator', 'Dungeon layout generator', 'Vegetation scatter generator'] },
  ],
  'scene-composer': [
    { featureName: 'Blender scene tree', category: 'Scene', description: 'useSceneComposerStore.refreshScene over /api/blender-mcp/scene rendered as a typed object tree by SceneTree' },
    { featureName: 'Scene object operations', category: 'Scene', description: 'select, duplicate and confirm-guarded delete executed through the MCP bridge and re-synced into the store', dependsOn: ['Blender scene tree'] },
    { featureName: 'Scene export', category: 'Export', description: 'SceneExporter FBX/glTF format picker emitting exportSceneScript to the configured output path', dependsOn: ['Blender scene tree'] },
    { featureName: 'Viewport screenshot preview', category: 'Preview', description: 'ViewportPreview capture of the live Blender viewport shown alongside the tree in the Composer tab' },
  ],
};

// ─── Checklist ↔ feature mapping ──────────────────────────────────────────────
//
// The GDD compliance audit used to relate a checklist item to a feature row with
// a 20-character substring test in both directions, taking the FIRST hit. Two
// things were wrong with that, both measured on the real DB (2026-08-18):
//
//   • Coverage. Only 88 of the 216 registry checklist items the audit can see
//     matched anything at all, so the `checklist-vs-scan` and `code-ahead` gap
//     categories were dark for 59% of the design surface. `ac-1` "Character
//     foundation package" — six C++ classes in one item — matched nothing.
//   • Arity. `features.find` returns one row, so an item covering six features
//     could only ever be evidenced by one of them.
//
// The relation is declared here instead, beside the features it names, in the
// same registry that already models `dependsOn`. It is keyed **module → item id
// → feature names** rather than by a flat item id, because checklist ids are NOT
// globally unique: `ai-1`…`ai-7` exist in both `arpg-inventory` and
// `ai-behavior`, and a flat map would silently cross-wire the two modules.
//
// Three deliberate states, all honest:
//   • a list of names  — this item is evidenced by exactly these feature rows;
//   • `[]`             — NOTHING in the feature matrix can evidence this item
//                        (verification/test/tuning items such as "Test full
//                        save/load cycle"). Mapping them to a plausible-looking
//                        feature is the false positive this table exists to
//                        remove, so they are declared empty on purpose;
//   • absent           — not mapped yet. The audit falls back to the substring
//                        heuristic and FLAGS the item as unmapped in the report;
//                        a fallback hit is never presented as a real mapping.
//
// Names must match `MODULE_FEATURE_DEFINITIONS[moduleId]` exactly (pinned by
// `src/__tests__/lib/evaluator/gdd-compliance-mapping.test.ts`). Cross-module
// references are deliberately not supported: the audit compares one module's
// checklist against that module's own scanned rows.
export const CHECKLIST_FEATURE_MAP: PartialModuleMap<Record<string, string[]>> = {
  // ─── Core Engine (aRPG curriculum) ──────────────────────────────────────────
  'arpg-character': {
    'ac-1': ['AARPGCharacterBase', 'Enhanced Input actions', 'AARPGPlayerController',
             'AARPGPlayerCharacter', 'Isometric camera', 'WASD movement'],
    'ac-2': ['Sprint system'],
    'ac-3': ['Dodge/dash'],
    'ac-4': ['AARPGGameMode', 'UARPGGameInstance'],
    'ac-5': ['WASD movement'],
    'ac-6': [], // runtime locomotion check — no feature row can evidence it
  },
  'arpg-animation': {
    'aa-1': ['UARPGAnimInstance'],
    'aa-2': ['Locomotion Blend Space'],
    'aa-3': ['Animation state machine'],
    'aa-4': ['Attack montages'],
    'aa-5': ['Anim Notify classes'],
    'aa-6': ['Motion Warping'],
    'aa-7': ['Root motion toggle'],
    'aa-8': ['Mixamo import & retarget pipeline'],
  },
  'arpg-gas': {
    'ag-1': ['AbilitySystemComponent'],
    'ag-2': ['Core AttributeSet'],
    'ag-3': ['Gameplay Tags hierarchy'],
    'ag-4': ['Base GameplayAbility'],
    'ag-5': ['Core Gameplay Effects'],
    'ag-6': ['Damage execution calculation'],
    'ag-7': ['Default attribute initialization'],
    'ag-8': [], // "Test and debug GAS"
  },
  'arpg-combat': {
    'acb-1': ['Melee attack ability'],
    'acb-2': ['Combo system'],
    'acb-3': ['Hit detection'],
    'acb-4': ['GAS damage application'],
    'acb-5': ['Hit reaction system'],
    'acb-6': ['Dodge ability (GAS)'],
    'acb-7': ['Death flow'],
    'acb-8': ['Combat feedback'],
    'acb-9': [], // "Create test dummy and validate combat loop"
  },
  'arpg-enemy-ai': {
    'ae-1': ['AARPGAIController'],
    'ae-2': ['AARPGEnemyCharacter'],
    'ae-3': ['AI Perception'],
    'ae-4': ['Behavior Tree'],
    'ae-5': ['EQS queries'],
    'ae-6': ['Enemy archetypes'],
    'ae-7': ['Enemy Gameplay Abilities'],
    'ae-8': ['Spawn system'],
  },
  'arpg-inventory': {
    'ai-1': ['UARPGItemDefinition'],
    'ai-2': ['UARPGItemInstance'],
    'ai-3': ['UARPGInventoryComponent'],
    'ai-4': ['Equipment slot system'],
    'ai-5': ['Equip/unequip GAS flow'],
    'ai-6': ['Consumable usage'],
    'ai-7': ['Affix system'],
    'ai-8': [], // "Test inventory operations"
  },
  'arpg-loot': {
    'al-1': ['UARPGLootTable'],
    'al-2': ['UARPGLootTable', 'Loot drop on death'],
    'al-3': ['Weighted random selection'],
    'al-4': ['AARPGWorldItem'],
    'al-5': ['Loot drop on death'],
    'al-6': ['Item pickup'],
    'al-7': ['Loot visual feedback'],
    'al-8': ['Chest/container actors'],
  },
  'arpg-ui': {
    'au-1': ['Main HUD widget'],
    'au-2': ['GAS attribute binding'],
    'au-3': ['Enemy health bars'],
    'au-4': ['Ability cooldown UI'],
    'au-5': ['Inventory screen'],
    'au-6': ['Character stats screen'],
    'au-7': ['Floating damage numbers'],
    'au-8': ['Pause/settings menus'],
  },
  'arpg-progression': {
    'ap-1': ['XP and Level attributes'],
    'ap-2': ['XP award on enemy death'],
    'ap-3': ['Level-up detection', 'XP curve table'],
    'ap-4': ['Active abilities'],
    'ap-5': ['Ability unlock system'],
    'ap-6': ['Attribute point allocation'],
    'ap-7': ['Ability loadout'],
    'ap-8': [], // "Test full progression loop"
  },
  'arpg-world': {
    'aw-1': ['Zone layout design'],
    'aw-2': ['Blockout levels'],
    'aw-3': ['Enemy spawn placement'],
    'aw-4': ['Interactive world objects'],
    'aw-5': ['Zone transitions'],
    'aw-6': ['Boss encounter'],
    'aw-7': ['Environmental hazards'],
    'aw-8': ['NavMesh coverage'],
  },
  'arpg-save': {
    'as-1': ['UARPGSaveGame'],
    'as-2': ['Custom serialization'],
    'as-3': ['Save function'],
    'as-4': ['Load function'],
    'as-5': ['Auto-save'],
    'as-6': ['Save slot system'],
    'as-7': ['Save versioning'],
    'as-8': [], // "Test full save/load cycle"
  },
  'arpg-polish': {
    'apl-1': ['Structured logging'],
    'apl-2': ['Debug draw helpers'],
    'apl-3': ['Debug console commands'],
    'apl-4': [], // "Profile with Unreal Insights"
    'apl-5': ['Object pooling'],
    'apl-6': ['Tick optimization'],
    'apl-7': ['Async asset loading'],
    'apl-8': [], // "Final integration test"
  },

  // ─── Content ────────────────────────────────────────────────────────────────
  'models': {
    'mod-1': ['Static mesh import pipeline', 'Skeletal mesh import'],
    'mod-2': ['LOD generation'],
    'mod-3': ['Collision setup'],
    'mod-4': ['Nanite mesh enabling'],
    'mod-5': [], // material slots / UV setup — no feature declared for it
    'mod-6': [], // asset validation workflow — no feature declared for it
  },
  'animations': {
    'anim-1': ['Custom AnimInstance base'],
    'anim-2': ['Blend Space setup'],
    'anim-3': ['Animation state machine'],
    'anim-4': ['Montage system'],
    'anim-5': ['Anim Notify framework'],
    'anim-6': ['Animation retargeting'],
    'anim-7': [], // "Test animation integration"
  },
  'materials': {
    'mat-1': ['Master material'],
    'mat-2': ['Dynamic material instances'],
    'mat-3': ['Material Parameter Collection'],
    'mat-4': ['Material functions library', 'Material layer system'],
    'mat-5': ['HLSL custom nodes'],
    'mat-6': [], // "Optimize material performance"
  },
  'level-design': {
    'ld-1': ['Blockout geometry'],
    'ld-2': ['Spawn point placement'],
    'ld-3': ['Level streaming setup', 'Zone transition system'],
    'ld-4': ['NavMesh configuration'],
    'ld-5': [], // "Add environmental storytelling"
    'ld-6': ['Blockout geometry', 'Environmental hazards'],
    'ld-7': [], // "Test level flow and pacing"
  },
  'ui-hud': {
    'ui-1': ['Main menu widget'],
    'ui-2': ['HUD framework'],
    'ui-3': ['Inventory screen'],
    'ui-4': ['Floating damage numbers'],
    'ui-5': ['Settings menu'],
    'ui-6': [], // notification system — no feature declared for it
    'ui-7': [], // "Test UI across resolutions"
  },
  'audio': {
    'aud-1': ['Sound manager subsystem'],
    'aud-2': ['Ambient sound system'],
    'aud-3': ['Dynamic music system'],
    'aud-4': [], // combat audio — no feature declared for it
    'aud-5': ['MetaSounds integration'],
    'aud-6': [], // "Test audio mix and spatialization"
  },

  // ─── Game Systems ───────────────────────────────────────────────────────────
  'ai-behavior': {
    'ai-1': ['AI Controller base'],
    'ai-2': ['Behavior Tree system'],
    'ai-3': ['AI Perception setup'],
    'ai-4': ['EQS queries'],
    'ai-5': ['Group AI coordination'],
    'ai-6': ['AI debugging tools'],
    'ai-7': ['AI Controller base', 'State Tree AI system'],
  },
  'physics': {
    'phy-1': ['Collision profiles and channels'],
    'phy-2': ['Physics materials'],
    'phy-3': ['Projectile system'],
    'phy-4': ['Chaos destruction'],
    'phy-5': [], // "Configure physics substepping"
    'phy-6': ['Physics constraints', 'Trace utilities'],
  },
  'multiplayer': {
    'mp-1': ['Replicated properties'],
    'mp-2': ['RPC framework'],
    'mp-3': ['GameState replication'],
    'mp-4': ['Session management'],
    'mp-5': ['Network prediction'],
    'mp-6': ['Net relevancy settings', 'Iris replication system'],
    'mp-7': [], // "Test full multiplayer flow"
  },
  'save-load': {
    'sl-1': ['USaveGame subclass'],
    'sl-2': ['Save and load functions', 'Custom serialization'],
    'sl-3': ['Auto-save system'],
    'sl-4': ['Save slot UI'],
    'sl-5': ['Save versioning'],
    'sl-6': [], // "Test full save/load cycle"
  },
  'input-handling': {
    'ih-1': ['Enhanced Input actions'],
    'ih-2': ['Input Mapping Context setup'],
    'ih-3': ['Key rebinding system'],
    'ih-4': ['Gamepad support'],
    'ih-5': ['Input mode management', 'Context-sensitive input'],
    'ih-6': [], // "Test input across scenarios"
  },
  'dialogue-quests': {
    'dq-1': ['Dialogue data asset'],
    'dq-2': ['Branching conversation system'],
    'dq-3': ['Quest tracker', 'Quest objectives'],
    'dq-4': ['Quest log UI'],
    'dq-5': ['NPC interaction system'],
    'dq-6': ['Branching conversation system', 'Quest objectives'],
  },
  'packaging': {
    'pkg-1': ['Build configuration'],
    'pkg-2': ['Cooking settings'],
    'pkg-3': ['Platform configuration'],
    'pkg-4': ['Build automation'],
    'pkg-5': ['Version numbering system'],
  },

  // ─── Visual Generation (Asset Studio) ───────────────────────────────────────
  // These nine modules used to be absent entirely — they declared no features,
  // so their 39 checklist items reported UNMAPPED forever. Each module's
  // component surface was read on 2026-08-18 and its features declared above;
  // the items follow here. Nine of the 39 resolve to `[]`: the app genuinely has
  // no artifact that could evidence them, and the reason is stated on the line.
  // Inventing a plausible-looking mapping for those nine is exactly the false
  // positive this table exists to remove.
  'asset-viewer': {
    'viewer-load': ['Model file loader', 'SceneViewer canvas'],
    'viewer-orbit': ['Orbit controls'],
    'viewer-lighting': ['Three-point scene lighting'],
    'viewer-wireframe': ['Render mode switching'],
    'viewer-grid': ['Grid and axis gizmo'],
    'viewer-export': ['Viewport screenshot export'],
  },
  'asset-forge': {
    'forge-prompt': ['Text-to-3D generation', 'Prompt chip builder'],
    'forge-image': ['Image-to-3D generation'],
    'forge-queue': ['Generation job queue', 'Job status polling'],
    'forge-preview': [], // no in-app 3D preview of a result: the queue shows status + critique, and nothing hands a finished mesh to the viewer
    'forge-export': ['Generated mesh gallery'],
  },
  'material-lab': {
    'mat-params': ['PBR parameter editor', 'Built-in material presets'],
    'mat-textures': ['Texture channel slots'],
    'mat-preview': ['Live PBR preview'],
    'mat-presets': ['Material preset store', 'Saved material API'],
    'mat-ue5': ['UE5 material instance export'],
  },
  'blender-pipeline': {
    'blender-detect': ['Blender install detection'],
    'blender-convert': ['FBX to glTF conversion', 'Blender MCP script runner'],
    'blender-lods': ['LOD generation'],
    'blender-optimize': ['Mesh optimization'],
  },
  'asset-browser': {
    'browse-polyhaven': ['Poly Haven search'],
    'browse-ambientcg': ['ambientCG search'],
    'browse-download': ['Asset library persistence', 'Collections and favourites'],
    'browse-preview': [], // cards show the source thumbnail only; there is no hand-off of a downloaded asset to the Asset Viewer or Material Lab
  },
  'import-automation': {
    'import-fbx': ['UE5 import script generator', 'Import configuration form'],
    'import-gltf': ['UE5 import script generator'],
    'import-preset': [], // the ImportConfig lives in component state — no preset save/load exists
    'import-batch': [], // the generator emits a single-asset script; there is no directory sweep or queue
  },
  'auto-rig': {
    'rig-prep': [], // no mesh preparation or validation tooling exists in this module
    'rig-mixamo': ['Mixamo workflow guide'],
    'rig-presets': ['Rig preset library'],
    'rig-retarget': [], // no UE5 IK Rig / IK Retargeter codegen exists; the only generated rig code is the Blender armature script
  },
  'procedural-engine': {
    'proc-terrain': ['Terrain heightmap generator', 'Generator parameter editors'],
    'proc-dungeon': ['Dungeon layout generator'],
    'proc-vegetation': ['Vegetation scatter generator'],
    'proc-preview': ['Canvas result previews', 'Blender export bridge'],
  },
  'scene-composer': {
    'sc-1': ['Blender scene tree', 'Scene object operations'],
    'sc-2': [], // no placement or transform workflow in this module — assets reach the scene from the Asset Browser's Blender import
    'sc-3': ['Scene export'],
  },
};

/**
 * The features an explicit mapping declares for a checklist item, or `null` when
 * the item is not mapped at all. `[]` is a real answer — "no feature row can
 * evidence this item" — and is deliberately distinct from `null`.
 */
export function mappedFeaturesFor(moduleId: SubModuleId, itemId: string): readonly string[] | null {
  const forModule = CHECKLIST_FEATURE_MAP[moduleId];
  if (!forModule) return null;
  return Object.prototype.hasOwnProperty.call(forModule, itemId) ? forModule[itemId] : null;
}

// ─── Checklist item → feature resolution (the ONE binding) ───────────────────
//
// Everything that scores a checklist item against the feature graph resolves the
// relation HERE, in this order:
//
//   1. `CHECKLIST_FEATURE_MAP` — exact, integrity-tested, and TERMINAL. `[]` is a
//      real answer ("no feature row can evidence this item") and must never fall
//      through to a guess: falling through is how a pure test item ends up
//      claiming it unblocks three features.
//   2. `ChecklistItem.features` — names the item declares for itself, filtered to
//      names that actually exist in `MODULE_FEATURE_DEFINITIONS[moduleId]`. A
//      declared name that resolves to nothing is REPORTED (`unresolved`), never
//      scored.
//   3. the first-word substring guess — a last resort that is labelled as a guess
//      everywhere it is surfaced, mirroring `gdd-compliance`'s provenance note.

/**
 * First-word fuzzy match: does `label` (case-insensitive) contain the first
 * whitespace-delimited token of `candidate`? The last-resort tier of
 * {@link resolveItemFeatures}, and the same heuristic the NBA engine uses for its
 * evaluator-rec / pattern / failure-history matches — so tuning it (or testing
 * it) happens in exactly one place.
 */
export function firstWordMatch(label: string, candidate: string): boolean {
  return label.toLowerCase().includes(candidate.toLowerCase().split(' ')[0]);
}

/** Which tier of {@link resolveItemFeatures} produced the binding. */
export type ItemFeatureSource = 'mapped' | 'declared' | 'heuristic' | 'none';

/** The sentence fragment that marks a tier-3 guess wherever it is surfaced. */
export const HEURISTIC_MATCH_NOTE = 'matched by name — not mapped';

export interface ResolvedItemFeatures {
  source: ItemFeatureSource;
  /** Feature names in THIS module the item is graded against. May be empty. */
  names: readonly string[];
  /**
   * EVERY name declared for this item — by `CHECKLIST_FEATURE_MAP` *and* by
   * `ChecklistItem.features` — that exists in no `MODULE_FEATURE_DEFINITIONS` row
   * for this module. Always computed, even when a higher tier won, so dead
   * authored data stays visible instead of being silently skipped. Never scored.
   */
  unresolved: readonly string[];
  /** One sentence naming where the relation came from. */
  note: string;
}

/** Minimal shape {@link resolveItemFeatures} needs — a `ChecklistItem` satisfies it. */
export interface ChecklistItemRef {
  id: string;
  label: string;
  features?: string[];
}

/**
 * Bind a checklist item to the feature rows that can evidence it.
 *
 * Pure and side-effect free. `names` is empty whenever nothing can evidence the
 * item — callers must treat that as "no fan-out to claim", not as a reason to
 * guess again.
 */
export function resolveItemFeatures(
  moduleId: SubModuleId,
  item: ChecklistItemRef,
): ResolvedItemFeatures {
  const defs = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
  const known = new Set(defs.map((d) => d.featureName));
  const mapped = mappedFeaturesFor(moduleId, item.id);
  const declared = item.features ?? [];

  // Dead authored data is reported no matter which tier wins.
  const unresolved = [
    ...new Set([...(mapped ?? []), ...declared].filter((n) => !known.has(n))),
  ];

  // 1. The explicit map wins, and `[]` is terminal.
  if (mapped) {
    const danglingMapped = mapped.filter((n) => !known.has(n));
    const dangling = danglingMapped.length > 0
      ? ` ${danglingMapped.length} mapped name(s) match no feature row: ${danglingMapped.join(', ')}.`
      : '';
    return {
      source: 'mapped',
      names: mapped.filter((n) => known.has(n)),
      unresolved,
      note: mapped.length === 0
        ? 'CHECKLIST_FEATURE_MAP declares that no feature row can evidence this item.'
        : `Relation declared in CHECKLIST_FEATURE_MAP.${dangling}`,
    };
  }

  // 2. Names the item declares for itself.
  const declaredNames = declared.filter((n) => known.has(n));
  if (declaredNames.length > 0) {
    return {
      source: 'declared',
      names: declaredNames,
      unresolved,
      note: 'Relation declared on the checklist item (ChecklistItem.features).',
    };
  }

  // 3. Last resort — a guess, and it says so.
  const guess = defs.find(
    (f) => firstWordMatch(item.label, f.featureName) || firstWordMatch(f.featureName, item.label),
  );
  if (guess) {
    return {
      source: 'heuristic',
      names: [guess.featureName],
      unresolved,
      note: `Feature "${guess.featureName}" ${HEURISTIC_MATCH_NOTE}.`,
    };
  }

  return {
    source: 'none',
    names: [],
    unresolved,
    note: 'No feature row matched this item.',
  };
}

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
 * Memoized: MODULE_FEATURE_DEFINITIONS is a static const, so direct deps are
 * resolved once and reused. The cached map should be treated as read-only —
 * use computeBlockers() to get a status-aware copy.
 */
let _cachedDepMap: Map<string, DependencyInfo> | null = null;
let _cachedDependentCounts: Map<string, number> | null = null;

export function buildDependencyMap(): Map<string, DependencyInfo> {
  if (_cachedDepMap) return _cachedDepMap;

  const map = new Map<string, DependencyInfo>();
  // Fan-out counts: how many features list each key as a direct dependency.
  // A static property of the graph — computed once in the same pass and cached
  // alongside the dep map via getDependentCounts().
  const dependentCounts = new Map<string, number>();

  // Resolve direct deps for every feature.
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      const deps = (feat.dependsOn ?? []).map((ref) => resolveDep(ref, moduleId));
      map.set(key, { deps, blockers: [], isBlocked: false });
      for (const dep of deps) {
        dependentCounts.set(dep.key, (dependentCounts.get(dep.key) ?? 0) + 1);
      }
    }
  }

  _cachedDepMap = map;
  _cachedDependentCounts = dependentCounts;
  return map;
}

/**
 * Fan-out count per feature key: how many features depend on each key.
 *
 * This is a static graph property (it never varies with status/progress), so it
 * is built once during {@link buildDependencyMap} and cached. Returns 0 for any
 * key with no dependents via the caller's `?? 0`.
 */
export function getDependentCounts(): Map<string, number> {
  if (!_cachedDependentCounts) {
    buildDependencyMap();
  }
  return _cachedDependentCounts!;
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

// ─── Module wiring assets (binary-content dependencies) ───────────────────────
// Declares the editor-authored assets each module needs to be runnable. Every
// SubModuleId MUST have an explicit entry (possibly []) — enforced by
// feature-definitions-wiring.test.ts so a new module forces a wiring decision.

export interface WiringAsset {
  name: string;
  kind:
    | 'WidgetBlueprint'
    | 'AnimBlueprint'
    | 'BehaviorTree'
    | 'DataTable'
    | 'InputMappingContext'
    | 'GameMode'
    | 'Material'
    | 'Other';
  note: string;
}

/** Kinds that cannot be authored from code at all — drive the matrix indicator. */
const BINARY_AUTHORABLE_ONLY: WiringAsset['kind'][] = ['WidgetBlueprint', 'AnimBlueprint', 'BehaviorTree'];

export const MODULE_WIRING_ASSETS: Partial<Record<SubModuleId, WiringAsset[]>> = {
  // Core Engine — aRPG
  'arpg-character': [
    { name: 'BP_ARPGPlayerCharacter', kind: 'Other', note: 'Blueprint subclass of the C++ player character used as DefaultPawn' },
    { name: 'IMC_Default', kind: 'InputMappingContext', note: 'Input Mapping Context added to the Enhanced Input subsystem on possess' },
    { name: 'BP_ARPGGameMode', kind: 'GameMode', note: 'GameMode with DefaultPawnClass / PlayerControllerClass / HUDClass set' },
  ],
  'arpg-animation': [
    { name: 'ABP_ARPGCharacter', kind: 'AnimBlueprint', note: 'Animation Blueprint reparented to the C++ UARPGAnimInstance; AnimGraph cannot be authored from code' },
  ],
  'arpg-gas': [],
  'arpg-combat': [
    { name: 'DT_DamageTypes', kind: 'DataTable', note: 'Damage/type rows referenced by the damage execution' },
    { name: 'AM_MeleeCombo', kind: 'Other', note: 'Combo montage — montage shell is automatable, section timing is editor work' },
  ],
  'arpg-enemy-ai': [
    { name: 'BT_Enemy', kind: 'BehaviorTree', note: 'Behavior Tree graph (Idle/Patrol/Chase/Attack) — graph cannot be authored from code' },
    { name: 'BB_Enemy', kind: 'Other', note: 'Blackboard asset with typed keys consumed by the BT' },
  ],
  'arpg-inventory': [],
  'arpg-loot': [
    { name: 'DT_LootTable', kind: 'DataTable', note: 'Weighted loot entries' },
  ],
  'arpg-ui': [
    { name: 'WBP_ARPGHUD', kind: 'WidgetBlueprint', note: 'UMG widget bound to the C++ HUD base via BindWidget — requires a WBP asset' },
  ],
  'arpg-progression': [
    { name: 'DT_XPCurve', kind: 'DataTable', note: 'XP-per-level curve table' },
  ],
  'arpg-world': [],
  'arpg-save': [],
  'arpg-polish': [],
  'core-engine-plan': [],

  // Content
  'models': [],
  'animations': [
    { name: 'ABP_Character', kind: 'AnimBlueprint', note: 'Animation Blueprint over the C++ AnimInstance base' },
  ],
  'materials': [
    { name: 'M_Master', kind: 'Material', note: 'Master material graph with static-switch parameters' },
  ],
  'level-design': [],
  'ui-hud': [
    { name: 'WBP_HUD', kind: 'WidgetBlueprint', note: 'UMG overlay for the AHUD subclass' },
  ],
  'audio': [],

  // Game Systems
  'ai-behavior': [
    { name: 'BT_Default', kind: 'BehaviorTree', note: 'Behavior Tree graph for the AI controller' },
  ],
  'physics': [],
  'multiplayer': [],
  'save-load': [],
  'input-handling': [
    { name: 'IMC_Default', kind: 'InputMappingContext', note: 'Input Mapping Context with the action bindings' },
  ],
  'dialogue-quests': [],
  'packaging': [],
  'blueprint-transpiler': [],

  // Evaluator
  'game-design-doc': [],

  // Visual Generation (Asset Studio)
  'asset-viewer': [],
  'asset-forge': [],
  'material-lab': [
    { name: 'M_LabMaster', kind: 'Material', note: 'Master material authored in the lab' },
  ],
  'blender-pipeline': [],
  'asset-browser': [],
  'import-automation': [],
  'auto-rig': [],
  'procedural-engine': [],
  'scene-composer': [],
};

/** Wiring assets for a module ([] when none declared). */
export function getWiringAssets(moduleId: SubModuleId): WiringAsset[] {
  return MODULE_WIRING_ASSETS[moduleId] ?? [];
}

/** True when a module depends on an asset that cannot be authored from code. */
export function moduleNeedsBinaryContent(moduleId: SubModuleId): boolean {
  return getWiringAssets(moduleId).some((a) => BINARY_AUTHORABLE_ONLY.includes(a.kind));
}
