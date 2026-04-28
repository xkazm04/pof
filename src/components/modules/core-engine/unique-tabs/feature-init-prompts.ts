/**
 * Per-feature initialization prompts for core-engine modules.
 *
 * Each section ID maps to a prompt that tells Claude how to:
 * 1. Create UE5 boilerplate files for this feature
 * 2. Set up the data bridge so PoF can read live project data
 * 3. Register the feature in the project's configuration
 *
 * Prompts are injected into CLI sessions via FeatureInitButton.
 */

import type { SubModuleId } from '@/types/modules';

export interface FeatureInitPrompt {
  /** Short action label for the button */
  label: string;
  /** Full prompt for the CLI session */
  prompt: string;
}

type InitPromptMap = Record<string, FeatureInitPrompt>;

/* ── Character Blueprint ────────────────────────────────────────────────── */

const CHARACTER_INIT: InitPromptMap = {
  'class-hierarchy': {
    label: 'Create character base classes',
    prompt: `Create the character class hierarchy for this ARPG project:
1. Create AARPGCharacterBase (extends ACharacter) with core stats (Health, Mana, Stamina)
2. Create AARPGPlayerCharacter and AARPGEnemyCharacter subclasses
3. Add a UDataTable reference for character archetypes
4. Create a JSON export of the class hierarchy at Config/CharacterHierarchy.json so PoF can read it
5. Verify the build compiles`,
  },
  'properties': {
    label: 'Set up character properties',
    prompt: `Set up the character property system:
1. Create FARPGCharacterStats struct (HP, Speed, AttackPower, Range, Armor, CritChance)
2. Add UPROPERTY(EditDefaultsOnly) stats to AARPGCharacterBase
3. Create a DataTable row struct FCharacterDataRow for loading stats from CSV/JSON
4. Export the property schema to Config/CharacterProperties.json for PoF to read
5. Verify build`,
  },
  'scaling': {
    label: 'Initialize stat scaling curves',
    prompt: `Set up level-based stat scaling:
1. Create UCurveTable assets or UCurveFloat references in AARPGCharacterBase for stat curves
2. Add a ScaleStatsByLevel(int32 Level) method that reads curves
3. Export sample curve data (levels 1-50) to Config/ScalingCurves.json
4. Verify build`,
  },
  'hitbox': {
    label: 'Create hitbox components',
    prompt: `Set up the hitbox/hurtbox system:
1. Create UARPGHitboxComponent (extends UCapsuleComponent) with HitboxType enum (Hurtbox, Hitbox, Pushbox)
2. Add default hitbox components to AARPGCharacterBase (body hurtbox)
3. Export hitbox zone config to Config/HitboxZones.json
4. Verify build`,
  },
  'camera': {
    label: 'Set up camera system',
    prompt: `Set up the third-person camera:
1. Create UARPGCameraProfile (UDataAsset) with FOV, ArmLength, SocketOffset, LagSpeed, LagMaxDistance
2. Add SpringArmComponent + CameraComponent to AARPGPlayerCharacter
3. Create 2-3 default camera presets (Combat, Exploration, Cinematic)
4. Export profiles to Config/CameraProfiles.json
5. Verify build`,
  },
  'bindings': {
    label: 'Initialize input bindings',
    prompt: `Set up Enhanced Input for the ARPG:
1. Create UInputAction assets for: Move, Look, Attack, Dodge, Interact, Ability1-4, Jump, Sprint, ToggleMenu
2. Create a UInputMappingContext with default keyboard+mouse bindings
3. Bind in AARPGPlayerCharacter::SetupPlayerInputComponent
4. Export binding map to Config/InputBindings.json for PoF to read
5. Verify build`,
  },
  'keyboard': {
    label: 'Create keyboard layout config',
    prompt: `Create the keyboard layout configuration:
1. Export all current input bindings to Config/KeyboardLayout.json with key names, categories, and conflict detection data
2. Add a helper function that detects duplicate key bindings
3. Verify build`,
  },
  'states': {
    label: 'Initialize movement states',
    prompt: `Set up the movement state machine:
1. Create EARPGMovementState enum (Idle, Walk, Run, Sprint, Dodge, Jump, Fall, Slide)
2. Add state tracking to AARPGCharacterBase with transition rules
3. Create UARPGMovementComponent extending UCharacterMovementComponent
4. Export state definitions to Config/MovementStates.json
5. Verify build`,
  },
  'dodge-trajectories': {
    label: 'Create dodge system',
    prompt: `Implement the dodge mechanic:
1. Create a DodgeAbility (or add dodge to movement component) with distance, duration, i-frames
2. Add directional dodge (8-way based on input)
3. Create UCurveFloat for dodge speed curve
4. Export dodge config to Config/DodgeConfig.json
5. Verify build`,
  },
  'curve-editor': {
    label: 'Set up feel curves',
    prompt: `Create the character feel tuning system:
1. Create UARPGFeelProfile (UDataAsset) with UCurveFloat references for acceleration, deceleration, turn rate
2. Add a default feel profile to AARPGPlayerCharacter
3. Export feel parameters to Config/FeelCurves.json
4. Verify build`,
  },
  'optimizer': {
    label: 'Create feel presets',
    prompt: `Create character feel optimization presets:
1. Create 3 UARPGFeelProfile presets: Responsive (twitchy), Weighty (Dark Souls), Balanced
2. Add a method to switch presets at runtime
3. Export preset list to Config/FeelPresets.json
4. Verify build`,
  },
  'comparison': {
    label: 'Set up comparison data',
    prompt: `Set up character comparison infrastructure:
1. Create a utility that iterates all AARPGCharacterBase blueprints and exports their stats
2. Export to Config/CharacterComparison.json with all character names, classes, and stat values
3. Add duplicate detection (characters with identical stat profiles)
4. Verify build`,
  },
  'balance': {
    label: 'Initialize balance radar',
    prompt: `Set up balance analysis:
1. Create FARPGBalanceProfile struct normalizing stats to 0-1 range
2. Add a static method to compute balance profile from character stats
3. Export all characters' balance profiles to Config/BalanceProfiles.json
4. Verify build`,
  },
};

/* ── Animation State Graph ──────────────────────────────────────────────── */

const ANIMATION_INIT: InitPromptMap = {
  'states': {
    label: 'Create anim state machine',
    prompt: `Create the animation state machine foundation:
1. Create UARPGAnimInstance (extends UAnimInstance) with state tracking
2. Define state nodes: Locomotion, Attacking, Dodging, HitReact, Death
3. Set up transition rules between states
4. Export state graph to Config/AnimStates.json
5. Verify build`,
  },
  'transitions': {
    label: 'Set up transitions',
    prompt: `Set up animation transition rules:
1. Define blend times between all state pairs in UARPGAnimInstance
2. Add conditional transition logic (stamina check for dodge, health for death)
3. Export transition matrix to Config/AnimTransitions.json
4. Verify build`,
  },
  'heatmap': { label: 'Initialize state heatmap', prompt: `Create animation state usage tracking:\n1. Add a state visit counter to UARPGAnimInstance\n2. Record state entry timestamps and durations\n3. Export heatmap data to Config/StateHeatmap.json\n4. Verify build` },
  'chain': { label: 'Create combo chains', prompt: `Set up the combo chain system:\n1. Create FARPGComboNode struct with input, montage, next nodes, cancel window\n2. Create UARPGComboGraph (UDataAsset) holding the combo tree\n3. Add a default 3-hit light combo chain\n4. Export combo graph to Config/ComboChains.json\n5. Verify build` },
  'montages': { label: 'Set up montage library', prompt: `Create the montage management system:\n1. Create a UDataTable listing all animation montages with metadata (category, duration, root motion)\n2. Add placeholder entries for Attack_Light, Attack_Heavy, Dodge, HitReact, Death\n3. Export montage list to Config/Montages.json\n4. Verify build` },
  'scrubber': { label: 'Create notify system', prompt: `Set up anim notifies:\n1. Create UARPGAnimNotify base class\n2. Create specific notifies: HitWindow, ComboWindow, VFXTrigger, SoundTrigger\n3. Add example notifies to an attack montage\n4. Export notify catalog to Config/AnimNotifies.json\n5. Verify build` },
  'skeleton': { label: 'Initialize retargeting', prompt: `Set up animation retargeting:\n1. Create an IK Rig asset for the main skeleton\n2. Define retarget chains (Spine, LeftArm, RightArm, LeftLeg, RightLeg, Head)\n3. Export skeleton mapping to Config/RetargetMap.json\n4. Verify build` },
  'trajectories': { label: 'Set up root motion', prompt: `Configure root motion curves:\n1. Enable root motion on AARPGCharacterBase movement component\n2. Add root motion extraction settings per montage\n3. Export trajectory configs to Config/RootMotionCurves.json\n4. Verify build` },
  'assets': { label: 'Create anim budget tracker', prompt: `Set up animation memory budgeting:\n1. Create a utility that scans all animation assets and calculates memory\n2. Group by category (Locomotion, Combat, Reactions, etc.)\n3. Export budget report to Config/AnimBudget.json\n4. Verify build` },
  'playrate': { label: 'Configure play rates', prompt: `Set up animation play rate config:\n1. Add PlayRate multiplier support to UARPGAnimInstance per state\n2. Create a DataTable mapping montages to their play rate ranges\n3. Export to Config/PlayRates.json\n4. Verify build` },
};

/* ── Ability Spellbook (GAS) ────────────────────────────────────────────── */

const GAS_INIT: InitPromptMap = {
  'architecture': { label: 'Set up GAS core', prompt: `Initialize the Gameplay Ability System:\n1. Add AbilitySystemComponent to AARPGCharacterBase\n2. Create UARPGAttributeSet with core attributes (Health, Mana, Strength, Dexterity, Intelligence)\n3. Create UARPGGameplayAbilityBase class\n4. Export architecture summary to Config/GASArchitecture.json\n5. Verify build` },
  'radar': { label: 'Create ability catalog', prompt: `Set up ability definitions:\n1. Create a UDataTable with ability metadata (name, cooldown, cost, damage type, range)\n2. Add 5 starter abilities: BasicAttack, Fireball, Dodge, HealSelf, WarCry\n3. Export ability list to Config/Abilities.json\n4. Verify build` },
  'cooldowns': { label: 'Initialize cooldowns', prompt: `Set up the cooldown system:\n1. Add cooldown GameplayEffect for each ability\n2. Create FARPGCooldownInfo struct tracking remaining/total\n3. Export cooldown config to Config/Cooldowns.json\n4. Verify build` },
  'timeline': { label: 'Create combo timeline', prompt: `Set up ability combo sequencing:\n1. Create FARPGComboSequence struct linking abilities in chains\n2. Add a combo tracker to the AbilitySystemComponent\n3. Export combo sequences to Config/AbilityCombos.json\n4. Verify build` },
  'effects-timeline': { label: 'Set up gameplay effects', prompt: `Create the gameplay effects library:\n1. Create base GE classes: GE_Damage, GE_Heal, GE_Buff_Duration, GE_Regen_Periodic\n2. Add stacking rules and duration configs\n3. Export effect definitions to Config/GameplayEffects.json\n4. Verify build` },
  'tags': { label: 'Initialize gameplay tags', prompt: `Set up the gameplay tag hierarchy:\n1. Create DefaultGameplayTags.ini with categories: Ability, State, Damage, Input, Cooldown\n2. Add tags for each ability and state\n3. Export tag tree to Config/GameplayTags.json\n4. Verify build` },
  'hierarchy': { label: 'Create tag hierarchy', prompt: `Expand the tag tree:\n1. Add sub-tags: Ability.Offensive, Ability.Defensive, Ability.Utility, State.InCombat, State.Stunned, etc.\n2. Document parent-child relationships\n3. Export full hierarchy to Config/TagHierarchy.json\n4. Verify build` },
  'audit': { label: 'Set up tag audit', prompt: `Create tag audit system:\n1. Create a utility that scans all abilities for tag usage\n2. Detect orphaned tags (defined but unused) and missing tags (used but undefined)\n3. Export audit results to Config/TagAudit.json\n4. Verify build` },
  'dependencies': { label: 'Map tag dependencies', prompt: `Analyze tag dependencies:\n1. Create a utility that maps which abilities block/require which tags\n2. Detect circular dependencies\n3. Export dependency graph to Config/TagDependencies.json\n4. Verify build` },
};

/* ── Combat Action Map ──────────────────────────────────────────────────── */

const COMBAT_INIT: InitPromptMap = {
  'lanes': { label: 'Create action lanes', prompt: `Set up combat action lanes:\n1. Create EARPGCombatLane enum (Melee, Ranged, AoE, Defensive)\n2. Tag each ability with its lane\n3. Export lane definitions to Config/CombatLanes.json\n4. Verify build` },
  'sequences': { label: 'Map combat sequences', prompt: `Create combat sequence diagrams:\n1. Document the full damage pipeline: Input → Ability → Animation → HitDetection → DamageCalc → Feedback\n2. Create FARPGCombatSequence struct capturing each step\n3. Export to Config/CombatSequences.json\n4. Verify build` },
  'traces': { label: 'Set up hit detection', prompt: `Initialize hit detection system:\n1. Create UARPGHitDetectionComponent with SphereTrace and CapsuleTrace support\n2. Configure trace channels and collision profiles\n3. Add trace configs per weapon type\n4. Export to Config/HitTraces.json\n5. Verify build` },
  'stats': { label: 'Create damage stats', prompt: `Set up damage statistics tracking:\n1. Create FARPGDamageRecord struct (source, target, ability, amount, type, timestamp)\n2. Add a combat stats tracker component\n3. Export stat config to Config/DamageStats.json\n4. Verify build` },
  'feedback-tuner': { label: 'Initialize combat feedback', prompt: `Set up combat feel/feedback system:\n1. Create UARPGCombatFeedbackConfig (UDataAsset) with: ScreenShake, Hitstop, CameraKick, ParticleScale\n2. Create default and heavy-hit presets\n3. Export feedback params to Config/CombatFeedback.json\n4. Verify build` },
  'dps': { label: 'Set up DPS tracking', prompt: `Create DPS calculation system:\n1. Add per-ability damage tracking to the combat stats component\n2. Calculate DPS over rolling 10-second windows\n3. Export DPS config to Config/DPSConfig.json\n4. Verify build` },
  'effectiveness': { label: 'Create effectiveness metrics', prompt: `Set up combat effectiveness analysis:\n1. Track hit rate, kill rate, ability usage frequency per combat encounter\n2. Create FARPGEffectivenessReport struct\n3. Export to Config/CombatEffectiveness.json\n4. Verify build` },
  'sankey': { label: 'Map damage flows', prompt: `Create damage flow tracking:\n1. Track damage source → pipeline → output for Sankey visualization\n2. Record: ability → damage type → modifiers applied → final amount\n3. Export flow data to Config/DamageFlows.json\n4. Verify build` },
  'kpis': { label: 'Initialize combat KPIs', prompt: `Set up combat KPI tracking:\n1. Define KPIs: TTK (time-to-kill), DPS, APM (actions-per-minute)\n2. Add threshold configs (green/amber/red) for each KPI\n3. Export KPI definitions to Config/CombatKPIs.json\n4. Verify build` },
};

/* ── Enemy Bestiary ─────────────────────────────────────────────────────── */

const BESTIARY_INIT: InitPromptMap = {
  'cards': { label: 'Create enemy archetypes', prompt: `Set up enemy archetype system:\n1. Create UARPGEnemyArchetype (UDataAsset) with: Name, Class, Role, Tier, BaseStats, MeshRef\n2. Create archetypes: MeleeGrunt, RangedCaster, Brute, EliteKnight, SwarmMinion\n3. Export to Config/EnemyArchetypes.json\n4. Verify build` },
  'modifiers': { label: 'Create elite modifiers', prompt: `Set up elite modifier system:\n1. Create FARPGEliteModifier struct (name, stat multipliers, visual FX tag, exclusion list)\n2. Create 6 modifiers: Berserker, Shielded, Vampiric, Frozen, Electrified, Enraged\n3. Export to Config/EliteModifiers.json\n4. Verify build` },
  'radar': { label: 'Set up stat comparison', prompt: `Create enemy stat comparison system:\n1. Normalize all archetype stats to 0-1 range for radar chart\n2. Create a utility that generates comparison profiles\n3. Export to Config/EnemyRadarData.json\n4. Verify build` },
  'behavior-tree': { label: 'Create base behavior tree', prompt: `Set up AI behavior trees:\n1. Create BT_EnemyBase with: Selector → (Combat sequence, Patrol sequence, Idle)\n2. Create UARPGBTTask_Attack, UARPGBTTask_Chase\n3. Set up Blackboard with: TargetActor, HomeLocation, CombatRange\n4. Export BT structure to Config/BehaviorTrees.json\n5. Verify build` },
  'decision-log': { label: 'Initialize AI logging', prompt: `Set up AI decision logging:\n1. Create UARPGAIDebugComponent that logs BT node transitions\n2. Record: timestamp, node name, result (Success/Failure/Running)\n3. Export log format to Config/AIDecisionLog.json\n4. Verify build` },
  'aggro': { label: 'Create threat system', prompt: `Set up the aggro/threat system:\n1. Create UARPGThreatComponent with threat table (Actor → ThreatValue)\n2. Add threat generation on: damage dealt, healing, ability use\n3. Add threat decay over time\n4. Export threat config to Config/AggroConfig.json\n5. Verify build` },
  'formations': { label: 'Set up formations', prompt: `Create enemy formation system:\n1. Create UARPGFormationTemplate (UDataAsset) with spawn point offsets per role\n2. Create templates: Line, Flanking, Surround, Ambush\n3. Export to Config/Formations.json\n4. Verify build` },
  'waves': { label: 'Create wave system', prompt: `Set up encounter wave system:\n1. Create FARPGWaveConfig struct (enemies[], spawnDelay, reinforcementThreshold)\n2. Create UARPGEncounterManager component\n3. Add a 3-wave test encounter\n4. Export to Config/WaveConfigs.json\n5. Verify build` },
  'difficulty': { label: 'Initialize difficulty curves', prompt: `Set up difficulty scaling:\n1. Create UCurveFloat for difficulty multiplier per encounter index\n2. Add enemy stat scaling based on difficulty\n3. Export difficulty curve to Config/DifficultyCurve.json\n4. Verify build` },
};

/* ── Item Catalog ───────────────────────────────────────────────────────── */

const ITEMS_INIT: InitPromptMap = {
  'grid': { label: 'Create inventory system', prompt: `Set up the inventory component:\n1. Create UARPGInventoryComponent with slot-based storage (TArray<FARPGItemSlot>)\n2. Create FARPGItemDefinition struct (Name, Slot, Rarity, Stats, Icon)\n3. Add basic CRUD operations (AddItem, RemoveItem, SwapSlots)\n4. Export inventory schema to Config/InventorySchema.json\n5. Verify build` },
  'sets': { label: 'Initialize item sets', prompt: `Set up item set system:\n1. Create UARPGItemSetDefinition (UDataAsset) with set name, member items, and set bonuses at 2/4/6 pieces\n2. Add set tracking to inventory component\n3. Create 2 example sets\n4. Export to Config/ItemSets.json\n5. Verify build` },
  'loadout': { label: 'Create equipment slots', prompt: `Set up equipment system:\n1. Create EARPGEquipmentSlot enum (Head, Chest, Legs, Feet, MainHand, OffHand, Ring1, Ring2, Amulet)\n2. Create UARPGEquipmentComponent with slot management\n3. Add equip/unequip methods with GAS attribute application\n4. Export to Config/EquipmentSlots.json\n5. Verify build` },
  'sources': { label: 'Map item sources', prompt: `Set up item source tracking:\n1. Create EARPGItemSource enum (Drop, Quest, Craft, Vendor, Chest)\n2. Tag each item definition with its source types\n3. Export source mapping to Config/ItemSources.json\n4. Verify build` },
  'scaling': { label: 'Initialize item scaling', prompt: `Set up item level scaling:\n1. Create item power curves (UCurveFloat) mapping item level to stat ranges\n2. Add rarity multipliers (Common: 1x, Rare: 1.3x, Epic: 1.6x, Legendary: 2x)\n3. Export scaling config to Config/ItemScaling.json\n4. Verify build` },
  'inv-stats': { label: 'Create stat aggregation', prompt: `Set up inventory stat aggregation:\n1. Create a method that sums all equipped item stats\n2. Feed aggregated stats into the GAS attribute set\n3. Export stat schema to Config/InventoryStats.json\n4. Verify build` },
  'power': { label: 'Set up power calculation', prompt: `Create item power scoring:\n1. Create a formula: Power = WeaponDamage × AttackSpeed + sum(StatWeights × StatValues)\n2. Add power display to item data\n3. Export power config to Config/ItemPower.json\n4. Verify build` },
};

/* ── Loot Table Visualizer ──────────────────────────────────────────────── */

const LOOT_INIT: InitPromptMap = {
  'pipeline': { label: 'Create loot pipeline', prompt: `Set up the loot generation pipeline:\n1. Create UARPGLootTable (UDataAsset) with weighted entries\n2. Create the pipeline: Roll rarity → Pick base item → Roll affixes → Create instance\n3. Export pipeline config to Config/LootPipeline.json\n4. Verify build` },
  'weights': { label: 'Initialize rarity weights', prompt: `Set up rarity weight distribution:\n1. Define rarity tiers: Common (50%), Uncommon (25%), Rare (15%), Epic (8%), Legendary (2%)\n2. Add weight modifiers per enemy tier and zone\n3. Export to Config/RarityWeights.json\n4. Verify build` },
  'world-items': { label: 'Create world item actors', prompt: `Set up world item pickup system:\n1. Create AARPGWorldItem actor with mesh, glow, interaction\n2. Add rarity-based visual effects (border glow color)\n3. Export world item config to Config/WorldItems.json\n4. Verify build` },
  'treemap': { label: 'Set up drop distribution', prompt: `Create drop distribution data:\n1. Organize all loot table entries into hierarchical categories\n2. Calculate cumulative probabilities per category\n3. Export treemap data to Config/DropDistribution.json\n4. Verify build` },
  'histogram': { label: 'Initialize drop brackets', prompt: `Set up drop rate brackets:\n1. Define per-rarity drop count expectations per hour of play\n2. Create FARPGDropBracket struct\n3. Export to Config/DropBrackets.json\n4. Verify build` },
  'simulator': { label: 'Create affix pool', prompt: `Set up the affix system:\n1. Create FARPGAffix struct (Name, Category, StatModifier, Tier, Weight)\n2. Create 15+ affixes across Offensive, Defensive, Utility categories\n3. Export affix pool to Config/AffixPool.json\n4. Verify build` },
  'co-occurrence': { label: 'Set up affix rules', prompt: `Define affix co-occurrence rules:\n1. Create exclusion list (conflicting affix pairs)\n2. Create synergy bonuses for complementary affixes\n3. Export to Config/AffixRules.json\n4. Verify build` },
  'timer': { label: 'Initialize pity system', prompt: `Set up pity/bad-luck protection:\n1. Create FARPGPityTracker with per-rarity pull counters\n2. Add guaranteed drop at threshold (e.g., Legendary at 100 pulls)\n3. Export pity config to Config/PityTimers.json\n4. Verify build` },
  'drought': { label: 'Create drought calculator', prompt: `Set up drought probability tracking:\n1. Calculate probability of N consecutive pulls without target rarity\n2. Add drought warning thresholds\n3. Export to Config/DroughtConfig.json\n4. Verify build` },
  'beacon': { label: 'Set up beacon system', prompt: `Create loot beacon/targeting system:\n1. Create UARPGLootBeacon struct that biases drops toward player needs\n2. Add smart loot rules (prioritize unowned slots, deprioritize duplicates)\n3. Export beacon configs to Config/LootBeacons.json\n4. Verify build` },
  'impact': { label: 'Initialize economy tracking', prompt: `Set up loot economy impact tracking:\n1. Calculate gold-per-hour from drop rates × vendor values\n2. Track item generation rates by tier\n3. Export economy model to Config/LootEconomy.json\n4. Verify build` },
};

/* ── Registry ───────────────────────────────────────────────────────────── */

const INIT_PROMPTS: Partial<Record<SubModuleId, InitPromptMap>> = {
  'arpg-character': CHARACTER_INIT,
  'arpg-animation': ANIMATION_INIT,
  'arpg-gas': GAS_INIT,
  'arpg-combat': COMBAT_INIT,
  'arpg-enemy-ai': BESTIARY_INIT,
  'arpg-inventory': ITEMS_INIT,
  'arpg-loot': LOOT_INIT,
};

/** Get the init prompt for a specific section of a module. */
export function getFeatureInitPrompt(
  moduleId: SubModuleId,
  sectionId: string,
): FeatureInitPrompt | undefined {
  return INIT_PROMPTS[moduleId]?.[sectionId];
}

/** Check if a module has any init prompts defined. */
export function hasInitPrompts(moduleId: SubModuleId): boolean {
  return !!INIT_PROMPTS[moduleId];
}
