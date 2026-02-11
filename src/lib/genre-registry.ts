import {
  User, Film, Sparkles, Swords, Bot, Package,
  Gem, Monitor, TrendingUp, Map, Save, Bug,
} from 'lucide-react';
import type { SubModuleDefinition, ChecklistItem, QuickAction } from '@/types/modules';
import type { GameGenre } from '@/stores/projectStore';

// ─── Checklist data per aRPG sub-module ───────────────────────────────────────

const ARPG_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'arpg-character': [
    { id: 'ac-1', label: 'Create Character base class', description: 'Create ACharacter subclass (AARPGCharacterBase) shared by player and enemies with UCharacterMovementComponent defaults.', prompt: 'Create an ACharacter subclass called AARPGCharacterBase in C++ with properly configured UCharacterMovementComponent (walk speed 600, rotation rate, acceleration). This will be the base class shared by player and enemy characters.' },
    { id: 'ac-2', label: 'Set up Enhanced Input actions', description: 'Create Input Actions (IA_Move, IA_Look, IA_Interact, IA_PrimaryAttack, IA_Dodge) as UInputAction assets and an Input Mapping Context.', prompt: 'Set up Enhanced Input System for my aRPG character. Create Input Actions for movement (IA_Move), look/camera (IA_Look), interact (IA_Interact), primary attack (IA_PrimaryAttack), and dodge (IA_Dodge). Create an Input Mapping Context (IMC_Default) binding these to WASD, mouse, E key, left click, and space bar.' },
    { id: 'ac-3', label: 'Bind input actions in PlayerController', description: 'Create APlayerController subclass, bind Enhanced Input actions, handle input routing.', prompt: 'Create an AARPGPlayerController subclass that sets up the Enhanced Input subsystem, adds the default Input Mapping Context, and binds all input actions (Move, Look, Interact, PrimaryAttack, Dodge) to handler functions.' },
    { id: 'ac-4', label: 'Implement camera system', description: 'Add Spring Arm + Camera component with top-down or third-person boom. Configure zoom, rotation, lag.', prompt: 'Add a Spring Arm and Camera component to my aRPG character for a top-down isometric view (like Diablo). Configure the spring arm with appropriate length (1200), rotation (-55 pitch), disable camera lag for responsive feel, and add mouse wheel zoom support.' },
    { id: 'ac-5', label: 'Implement movement system', description: 'Wire up WASD movement or click-to-move using NavigationSystem. Handle character rotation toward movement direction.', prompt: 'Implement WASD movement for my aRPG character using Enhanced Input. The character should move relative to the camera direction, rotate smoothly toward the movement direction using interpolation (not instant snapping), and support both keyboard and click-to-move via UNavigationSystemV1.' },
    { id: 'ac-6', label: 'Implement dodge/dash', description: 'Create a dodge roll or dash ability with velocity impulse or root motion. Brief invulnerability during dodge.', prompt: 'Implement a dodge roll ability for my aRPG character. When the player presses dodge, the character should dash in the movement direction (or backward if stationary) using root motion from a dodge animation montage. Add a brief invulnerability window during the dodge using a gameplay tag.' },
    { id: 'ac-7', label: 'Create GameMode and GameInstance', description: 'Set up AGameModeBase subclass for player spawning and AGameInstance for persistent cross-level data.', prompt: 'Create an AARPGGameMode class that handles player spawning with the correct default pawn and player controller classes. Also create a UARPGGameInstance subclass for storing persistent data across level transitions (player progress, settings).' },
    { id: 'ac-8', label: 'Test on uneven terrain', description: 'Test character movement on ramps, stairs, edges. Verify camera behavior. Ensure smooth experience.', prompt: 'Review my character movement setup for edge cases. Check that the character handles ramps, stairs, and ledges properly. Verify the CharacterMovementComponent settings for step height, walkable floor angle, and falling behavior. Create a test level with various terrain types.' },
  ],
  'arpg-animation': [
    { id: 'aa-1', label: 'Create AnimInstance C++ class', description: 'Create UAnimInstance subclass with movement variables (Speed, Direction, IsInAir) exposed to Animation Blueprint.', prompt: 'Create a UARPGAnimInstance C++ class that derives from UAnimInstance. Override NativeUpdateAnimation to calculate Speed (from velocity), Direction, IsInAir (from movement component), and IsDead variables. Expose these with UPROPERTY(BlueprintReadOnly) for the Animation Blueprint.' },
    { id: 'aa-2', label: 'Set up locomotion Blend Space', description: 'Create a 1D or 2D Blend Space for Idle/Walk/Run transitions based on speed.', prompt: 'Guide me through creating a 1D Blend Space for my aRPG character locomotion. It should blend between Idle (speed 0), Walk (speed 200), and Run (speed 600) animations. Explain the Blend Space setup in UE5 and how to reference it from the Animation Blueprint.' },
    { id: 'aa-3', label: 'Build animation state machine', description: 'Create Animation Blueprint with states: Locomotion, Attacking, Dodging, Hit React, Death. Wire transitions.', prompt: 'Create an Animation Blueprint state machine for my aRPG character with these states: Locomotion (uses blend space), Attacking (plays montage), Dodging (plays roll montage), HitReact (plays hit reaction), and Death (plays death animation then holds final pose). Define transition rules between each state.' },
    { id: 'aa-4', label: 'Create attack animation montages', description: 'Set up Animation Montages for a 3-hit melee combo with montage sections for chaining.', prompt: 'Create Animation Montage setup for a 3-hit melee attack combo. Each hit should be a separate montage section so they can chain. Add Anim Notifies for: AN_ComboWindow (when next input is accepted), AN_EnableHitbox (start of damage window), AN_DisableHitbox (end of damage window). Explain the C++ notify classes.' },
    { id: 'aa-5', label: 'Implement anim notifies', description: 'Create C++ Anim Notify classes: ComboWindow, EnableHitbox, DisableHitbox, SpawnVFX, PlaySound.', prompt: 'Create C++ Anim Notify classes for my aRPG: UAnimNotify_ComboWindow (signals combo input window open/close), UAnimNotifyState_HitDetection (enables/disables weapon hit detection for the duration), UAnimNotify_SpawnVFX (spawns a Niagara effect), and UAnimNotify_PlaySound (plays a sound cue). Show how to use them in montages.' },
    { id: 'aa-6', label: 'Set up Motion Warping', description: 'Enable Motion Warping plugin and add notify states for attack magnetism toward targets.', prompt: 'Set up Motion Warping for my aRPG attacks. Add UMotionWarpingComponent to the character. Create Motion Warping notify states in attack montages so that melee attacks slightly magnetize the character toward the target (like Dark Souls/Elden Ring lock-on attacks). Show how to set the warp target from the combat system.' },
    { id: 'aa-7', label: 'Configure root motion toggle', description: 'Enable root motion for attacks and dodges, disable for normal locomotion. Handle transitions.', prompt: 'Set up root motion handling for my aRPG character. Root motion should be ON during attack montages and dodge rolls (for precise movement) but OFF during normal locomotion (WASD movement). Show how to configure this in the AnimInstance and CharacterMovementComponent.' },
    { id: 'aa-8', label: 'Import and test animations', description: 'Import placeholder animations (Mixamo or marketplace), assign to blend spaces and montages, test full flow.', prompt: 'Guide me through importing animations for my aRPG character. I need placeholder animations from Mixamo for: idle, walk, run, 3-hit sword combo, dodge roll, hit reaction, and death. Show the import settings, retargeting if needed, and how to assign them to the blend spaces and montages we created.' },
  ],
  'arpg-gas': [
    { id: 'ag-1', label: 'Add AbilitySystemComponent to character', description: 'Add ASC to character base class. Implement IAbilitySystemInterface. Initialize in BeginPlay.', prompt: 'Add UAbilitySystemComponent to my AARPGCharacterBase class. Implement the IAbilitySystemInterface to return the ASC. Initialize the ASC properly in BeginPlay and PossessedBy. Handle the owner actor and avatar actor setup for both player and AI characters.' },
    { id: 'ag-2', label: 'Create core AttributeSet', description: 'Define Health, MaxHealth, Mana, MaxMana, Strength, Dexterity, Intelligence, Armor, AttackPower attributes.', prompt: 'Create a UARPGAttributeSet class with these aRPG attributes: Health, MaxHealth, Mana, MaxMana, Strength, Dexterity, Intelligence, Armor, AttackPower, CriticalChance, CriticalDamage. Implement PreAttributeChange for clamping and PostGameplayEffectExecute for handling health reaching zero (death event).' },
    { id: 'ag-3', label: 'Set up Gameplay Tags hierarchy', description: 'Define tag hierarchy: Ability.*, State.*, Damage.*, Item.*, Input.*. Register in DefaultGameplayTags.ini.', prompt: 'Set up the Gameplay Tags hierarchy for my aRPG. Define tags for: Ability (Ability.Melee.LightAttack, Ability.Melee.HeavyAttack, Ability.Ranged.Fireball, Ability.Dodge), State (State.Dead, State.Stunned, State.Invulnerable, State.Attacking), Damage (Damage.Physical, Damage.Fire, Damage.Ice, Damage.Lightning), and Input (InputTag.PrimaryAttack, InputTag.Dodge). Show how to register these.' },
    { id: 'ag-4', label: 'Create base GameplayAbility class', description: 'Create UGameplayAbility subclass with shared aRPG logic: cost checking, cooldown, activation tags.', prompt: 'Create a UARPGGameplayAbility base class that all aRPG abilities derive from. Include: automatic cost/cooldown checking, activation blocked by State.Dead/State.Stunned tags, helper functions for getting the character and ASC, a CommitAbility wrapper, and a convenient way to apply gameplay effects to targets.' },
    { id: 'ag-5', label: 'Create core Gameplay Effects', description: 'Create GE_Damage (instant), GE_Heal (instant), GE_Buff (duration), GE_Regen (periodic) effect classes.', prompt: 'Create core Gameplay Effect blueprints/classes for my aRPG: GE_Damage (instant, modifies Health), GE_Heal (instant, adds Health clamped to MaxHealth), GE_Buff_Strength (duration-based, adds Strength for 10s), GE_Regen_Health (periodic, restores Health every 2s). Show how to use modifiers, duration policies, and period.' },
    { id: 'ag-6', label: 'Implement damage execution calculation', description: 'Create UGameplayEffectExecutionCalculation for damage formula factoring armor, resistances, crits.', prompt: 'Create a UARPGDamageExecution class (UGameplayEffectExecutionCalculation) that implements the aRPG damage formula: FinalDamage = (BaseDamage + AttackPower * Scaling) * (1 + CritDamage if crit) * (1 - DamageReduction from Armor). Capture source AttackPower and CritChance, target Armor. Apply the result to target Health.' },
    { id: 'ag-7', label: 'Initialize default attributes', description: 'Use Curve Tables or Data Tables to define base attribute values per character level.', prompt: 'Set up default attribute initialization for my aRPG characters using a Data Table. Create a struct with base values for all attributes. Use UAbilitySystemComponent::InitStats or a Gameplay Effect with SetByCaller modifiers to initialize attributes when a character spawns. Show per-level scaling with a Curve Table.' },
    { id: 'ag-8', label: 'Test and debug GAS', description: 'Use showdebug abilitysystem console command. Apply effects, verify attribute changes, test ability activation.', prompt: 'Guide me through testing and debugging my GAS setup. Show how to use the showdebug abilitysystem console command, how to verify attributes are initializing correctly, how to test applying a damage effect and seeing health drop, and how to diagnose common GAS issues (ability not activating, effect not applying, tags not blocking).' },
  ],
  'arpg-combat': [
    { id: 'acb-1', label: 'Create melee attack ability', description: 'Create GA_LightAttack GameplayAbility that plays attack montage and handles combo input.', prompt: 'Create a GA_MeleeAttack Gameplay Ability for my aRPG. It should: activate on input, play the attack animation montage using AbilityTask_PlayMontageAndWait, handle combo window via WaitGameplayEvent, allow chaining into next combo section if input received during combo window, and commit mana cost if applicable.' },
    { id: 'acb-2', label: 'Implement combo system', description: 'Track combo count, advance montage sections on input during combo window, reset on timeout.', prompt: 'Implement a combo system for my aRPG melee attacks. Track the current combo count (1-3), advance to the next montage section when the player inputs attack during the combo window (signaled by AN_ComboWindow notify), reset combo on timeout or if the full chain completes. Each hit in the combo should do progressively more damage.' },
    { id: 'acb-3', label: 'Implement hit detection', description: 'Create weapon trace system or overlap-based hit detection activated by anim notifies.', prompt: 'Implement hit detection for my aRPG melee attacks. Use sphere trace from the weapon socket during the hit detection window (enabled/disabled by anim notify state). The trace should check each frame during the window, collect all hit actors (no duplicates per swing using a TSet), and apply damage via GAS GameplayEffect to each hit target.' },
    { id: 'acb-4', label: 'Apply damage via GAS', description: 'Create FGameplayEffectSpec with damage value on hit, apply to target ASC, trigger hit events.', prompt: 'Implement the damage application flow for my aRPG combat. When a hit is detected: create a FGameplayEffectSpecHandle using GE_Damage, set the damage magnitude using SetByCaller or the execution calculation, apply it to the target AbilitySystemComponent, and send a GameplayEvent to the target for hit reaction.' },
    { id: 'acb-5', label: 'Implement hit reaction system', description: 'Target receives gameplay event on hit, plays hit react montage, brief stun/hitstop.', prompt: 'Implement a hit reaction system. When a character takes damage: play a hit reaction animation montage (using AbilityTask), apply brief hitstop (50ms time dilation), trigger camera shake, spawn hit VFX at impact point, and play hit sound. The hit reaction should be interruptible by another hit (for juggling).' },
    { id: 'acb-6', label: 'Implement dodge with i-frames', description: 'Create GA_Dodge ability with invulnerability frames, State.Invulnerable tag during dodge.', prompt: 'Implement the dodge ability as a Gameplay Ability (GA_Dodge). On activation: grant State.Invulnerable tag (blocks incoming damage effects), play dodge roll montage with root motion, consume stamina/mana cost, apply cooldown. Remove invulnerability tag when montage ends. The dodge direction should match the movement input.' },
    { id: 'acb-7', label: 'Implement death flow', description: 'Health reaches 0 triggers State.Dead tag, death montage, disable input, ragdoll or dissolve.', prompt: 'Implement the death flow for my aRPG. When PostGameplayEffectExecute detects Health <= 0: grant State.Dead tag (blocks all abilities), play death animation montage, disable player input or AI behavior, after montage optionally enable ragdoll physics. For enemies: trigger loot drop, remove from AI system, start dissolve timer.' },
    { id: 'acb-8', label: 'Add combat feedback', description: 'Camera shake, hitstop, hit VFX (Niagara), floating damage numbers, controller vibration.', prompt: 'Add juicy combat feedback to my aRPG. Implement: camera shake on hit (UCameraShakeBase), brief hitstop (15-30ms SetGlobalTimeDilation), hit spark VFX using Niagara at impact point, floating damage numbers (UMG widget spawned at hit location), and optional controller vibration using force feedback effects.' },
    { id: 'acb-9', label: 'Create test dummy and validate combat loop', description: 'Spawn a static enemy with health bar, test full attack-damage-death loop.', prompt: 'Create a test dummy enemy actor with a health bar widget, an AbilitySystemComponent with AttributeSet (Health: 100). Place it in the test level. Validate the full combat loop: attack the dummy, see hit detection, damage numbers appear, health bar decreases, dummy plays hit reaction, when health reaches 0 it dies. Verify combo chaining works.' },
  ],
  'arpg-enemy-ai': [
    { id: 'ae-1', label: 'Create AIController subclass', description: 'Create AAIController with behavior tree runner, blackboard, and perception component.', prompt: 'Create an AARPGAIController subclass that runs a Behavior Tree. Set up UBlackboardComponent with keys: TargetActor (Object), PatrolLocation (Vector), DistanceToTarget (Float), HasLineOfSight (Bool). Initialize the blackboard and run the behavior tree in OnPossess.' },
    { id: 'ae-2', label: 'Create enemy character base', description: 'Extend AARPGCharacterBase for enemies with own ASC, attributes, and AI-specific setup.', prompt: 'Create an AARPGEnemyCharacter class extending AARPGCharacterBase. It should have its own AbilitySystemComponent and AttributeSet with enemy-specific defaults (Health, AttackPower, etc. initialized from a Data Table). Set the AI Controller class, add a UWidgetComponent for floating health bar, and handle death cleanup (disable collision, stop AI).' },
    { id: 'ae-3', label: 'Set up AI Perception', description: 'Configure sight and damage perception senses. Set up stimuli sources on player.', prompt: 'Set up AI Perception for my aRPG enemies. Add UAIPerceptionComponent to the AI controller with UAISenseConfig_Sight (sight radius 1500, lose sight radius 2000, peripheral vision 90 degrees) and UAISenseConfig_Damage. Add UAIPerceptionStimuliSourceComponent to the player character. Show how to handle perception updates in the AI controller to set blackboard keys.' },
    { id: 'ae-4', label: 'Create basic Behavior Tree', description: 'Build BT with states: Idle, Patrol, Chase, Attack, Retreat. Use decorators for transitions.', prompt: 'Create a Behavior Tree for a basic melee enemy in my aRPG. Structure: Root -> Selector with three branches: (1) Attack sequence (decorator: is in attack range, task: face target, task: execute attack ability, task: wait cooldown), (2) Chase sequence (decorator: has target, task: move to target), (3) Patrol sequence (task: find random patrol point via EQS, task: move to point, task: wait). Create the necessary BTTask and BTDecorator C++ classes.' },
    { id: 'ae-5', label: 'Create EQS queries', description: 'Build Environment Queries for patrol points, attack positions, and flanking positions.', prompt: 'Create EQS (Environment Query System) queries for my aRPG enemy AI. Create queries for: FindPatrolPoint (random reachable point within radius), FindAttackPosition (position near player at melee range), FindFlankPosition (position behind or beside the player). Show the C++ EQS test and generator classes needed.' },
    { id: 'ae-6', label: 'Create enemy archetypes', description: 'Build 3 enemy types: Melee Grunt (chase+swing), Ranged (keep distance+shoot), Brute (charge+heavy).', prompt: 'Create 3 enemy archetypes for my aRPG: (1) Melee Grunt - chases player and does light attacks, low health, (2) Ranged Caster - keeps distance (800 units), fires projectiles, retreats if player gets close, (3) Brute - high health, charges at player for heavy attack, brief vulnerability after charge. Each should use the shared behavior tree with different blackboard values, or separate BTs.' },
    { id: 'ae-7', label: 'Give enemies Gameplay Abilities', description: 'Create GA_EnemyMeleeAttack, GA_EnemyRangedAttack using GAS for enemy attacks.', prompt: 'Create Gameplay Abilities for enemy attacks: GA_EnemyMeleeAttack (plays swing montage, does damage in front arc), GA_EnemyRangedAttack (spawns projectile toward target using ProjectileMovementComponent, applies damage on hit), GA_EnemyChargeAttack (dashes toward target with Motion Warping, AoE damage on arrival). All should use the GAS damage execution.' },
    { id: 'ae-8', label: 'Implement spawn system', description: 'Create enemy spawn points, wave spawning, spawn-on-trigger volumes, difficulty scaling.', prompt: 'Create an enemy spawn system for my aRPG. Implement: AEnemySpawnPoint actor (configurable enemy class, respawn timer), ASpawnVolume trigger (spawns a wave of enemies when player enters), wave spawning with configurable count/delay/difficulty. Include a simple difficulty scaling that increases enemy health and damage based on player level.' },
  ],
  'arpg-inventory': [
    { id: 'ai-1', label: 'Create item definition data asset', description: 'Create UPrimaryDataAsset subclass for item definitions with name, icon, type, rarity, stats.', prompt: 'Create a UARPGItemDefinition class extending UPrimaryDataAsset. Properties: FText DisplayName, FText Description, UTexture2D* Icon, EItemType Type (enum: Weapon, Armor, Consumable, Material, QuestItem), EItemRarity Rarity (enum: Common, Magic, Rare, Legendary), TSubclassOf<UGameplayEffect> OnEquipEffect, TSubclassOf<UGameplayEffect> OnUseEffect, UStaticMesh* WorldMesh.' },
    { id: 'ai-2', label: 'Create item instance runtime object', description: 'Runtime UObject that holds item definition reference plus instance-specific data (affixes, stack count).', prompt: 'Create a UARPGItemInstance UObject class that represents a specific item in the game world or inventory. Properties: UARPGItemDefinition* Definition, int32 StackCount, int32 ItemLevel, TArray<FItemAffix> Affixes (struct with GameplayEffect + magnitude), FGuid UniqueId. Add helper methods: GetDisplayName, GetTotalStats, CanStack.' },
    { id: 'ai-3', label: 'Create inventory component', description: 'UActorComponent that holds items with Add, Remove, Move, Sort, Find operations.', prompt: 'Create a UARPGInventoryComponent (ActorComponent) that manages the player inventory. Use TArray<UARPGItemInstance*> Items with a configurable MaxSlots. Implement: AddItem (auto-stack if stackable), RemoveItem, MoveItem (between slots), FindItemByDefinition, GetItemAtSlot, Sort (by type then rarity). Fire delegates on inventory change for UI updates.' },
    { id: 'ai-4', label: 'Implement equipment slots', description: 'Define equipment slot system: Weapon, Helm, Chest, Gloves, Boots, Ring1, Ring2, Amulet.', prompt: 'Create an equipment slot system for my aRPG. Define EEquipmentSlot enum (Weapon, OffHand, Helm, Chest, Gloves, Boots, Ring1, Ring2, Amulet). Add a TMap<EEquipmentSlot, UARPGItemInstance*> EquippedItems to the inventory component. Each slot should only accept items of matching type. Fire delegates when equipment changes.' },
    { id: 'ai-5', label: 'Implement equip/unequip flow', description: 'Equipping applies item GameplayEffect to ASC (stat bonuses), unequipping removes it.', prompt: 'Implement the equip/unequip flow using GAS. When an item is equipped: apply its OnEquipEffect (a Gameplay Effect with infinite duration) to the character AbilitySystemComponent, giving stat bonuses (e.g., +10 Strength, +5 Armor). Store the FActiveGameplayEffectHandle. When unequipped: remove the effect using the handle. Verify attribute changes update the HUD.' },
    { id: 'ai-6', label: 'Implement consumable use', description: 'Using a consumable (health potion) applies its GameplayEffect and decrements stack.', prompt: 'Implement consumable item usage for my aRPG. When the player uses a consumable: apply its OnUseEffect (e.g., GE_Heal_Potion that restores 50 Health instantly), decrement StackCount, remove item if stack reaches 0. Add a cooldown system for potion usage (prevent spam). Bind potion use to a hotkey input action.' },
    { id: 'ai-7', label: 'Create item rarity and affix system', description: 'Define rarity tiers with color coding and affix count rules. Random affix generation.', prompt: 'Create the item rarity and affix system. Rarity tiers: Common (white, 0 affixes), Magic (blue, 1-2 affixes), Rare (yellow, 3-4 affixes), Legendary (orange, 4-6 affixes + unique effect). Create a Data Table of possible affixes (FItemAffix: GameplayTag AffixTag, float MinValue, float MaxValue, TSubclassOf<UGameplayEffect> Effect). Implement random affix rolling when items are generated.' },
    { id: 'ai-8', label: 'Test inventory operations', description: 'Pick up items, view in inventory, equip weapon, see stats change, use potion.', prompt: 'Create a test scenario for the inventory system. Spawn several test items in the world (sword, armor, potion). Walk over them to pick up (or press interact). Open inventory, see items listed. Equip the sword, verify AttackPower attribute increases. Equip armor, verify Armor attribute increases. Use health potion after taking damage, verify health restored.' },
  ],
  'arpg-loot': [
    { id: 'al-1', label: 'Create loot table data asset', description: 'Define loot tables as data assets with item-weight pairs, min/max quantity, rarity distribution.', prompt: 'Create a UARPGLootTable data asset class. Properties: TArray<FLootEntry> Entries where FLootEntry has: UARPGItemDefinition* Item, float DropWeight, int32 MinQuantity, int32 MaxQuantity, EItemRarity MinRarity, EItemRarity MaxRarity. Add a float NothingWeight for chance of no drop. Implement a RollLoot function that returns TArray<UARPGItemInstance*> using weighted random selection.' },
    { id: 'al-2', label: 'Assign loot tables to enemies', description: 'Give each enemy archetype a loot table reference. Bosses get higher rarity chances.', prompt: 'Add a UARPGLootTable* LootTable property to the enemy character base. Assign different loot tables to each archetype: Grunt (common items, low gold), Ranged Caster (chance of magic items), Brute (guaranteed magic+, rare material chance), Boss (guaranteed rare+, legendary chance). Show how to create the loot table data assets in the editor.' },
    { id: 'al-3', label: 'Implement weighted random drop selection', description: 'Create the drop rolling algorithm with proper weight normalization and rarity weighting.', prompt: 'Implement the weighted random loot selection algorithm. Given a loot table with entries and weights: normalize weights to sum to 1.0 (including NothingWeight), roll a random float, iterate entries accumulating weight until the roll is exceeded. For each dropped item, roll its rarity (higher player level = better rarity odds) and affixes. Return the generated item instances.' },
    { id: 'al-4', label: 'Create world loot actor', description: 'AWorldItem actor that spawns when enemy dies, shows item mesh/icon, has interaction prompt.', prompt: 'Create an AARPGWorldItem actor that represents a dropped item in the world. It should: display the item mesh (or a generic loot bag mesh), have a USphereComponent for pickup detection, show a floating nameplate widget (item name colored by rarity), have a visible light/beam effect colored by rarity (Niagara), and support interact-to-pickup or walk-over-pickup.' },
    { id: 'al-5', label: 'Implement loot drop on death', description: 'When enemy dies, roll loot table and spawn AWorldItem actors at death location.', prompt: 'Implement loot dropping when enemies die. In the enemy death flow: call LootTable->RollLoot(), for each resulting item instance, spawn an AARPGWorldItem at the enemy location with a slight random offset and upward impulse (so loot scatters). Also drop gold (random amount based on enemy level) as a separate pickup.' },
    { id: 'al-6', label: 'Implement item pickup', description: 'Player walks over or interacts with world item, adds to inventory, destroys world actor.', prompt: 'Implement item pickup for my aRPG. When the player overlaps with AARPGWorldItem (or presses interact): call the player InventoryComponent->AddItem with the item instance. If inventory is full, show a "inventory full" message and dont destroy the world item. On successful pickup: play pickup sound, show brief pickup notification, destroy the world actor.' },
    { id: 'al-7', label: 'Add loot quality visual feedback', description: 'Color-coded nameplates, rarity beams above items, minimap icons for rare+ drops.', prompt: 'Enhance loot visual feedback in my aRPG. Implement: color-coded item nameplates (white=Common, blue=Magic, yellow=Rare, orange=Legendary), vertical light beam above Magic+ drops using Niagara (blue/yellow/orange beam), pickup sound that varies by rarity, and a brief screen notification when picking up Rare+ items showing the item name and stats.' },
    { id: 'al-8', label: 'Create chest and container actors', description: 'Interactive chests that use loot tables when opened, with open animation and cooldown.', prompt: 'Create an AARPGLootChest actor. When the player interacts: play open animation (flip lid), roll its assigned loot table, spawn world items in front of the chest. The chest should have a visual state (closed/open), not be re-openable once looted, and persist its opened state for save/load. Create variants: wooden chest (common loot), golden chest (rare+ loot).' },
  ],
  'arpg-ui': [
    { id: 'au-1', label: 'Set up HUD framework', description: 'Create main HUD widget with health/mana bars, ability bar, and minimap placeholder.', prompt: 'Create the main HUD widget for my aRPG using UMG. Layout: bottom-left health bar (red) and mana bar (blue) with numeric values, bottom-center ability hotbar (4 slots with cooldown overlays), top-right minimap placeholder, top-left zone name. Create the C++ UUserWidget base class and bind to GAS attribute delegates for real-time updates.' },
    { id: 'au-2', label: 'Bind HUD to GAS attributes', description: 'Listen for Health, MaxHealth, Mana, MaxMana attribute changes and update bars in real time.', prompt: 'Bind my HUD health and mana bars to the GAS AttributeSet. Use AbilitySystemComponent->GetGameplayAttributeValueChangeDelegate() to listen for Health and Mana changes. Update the progress bar fill percentage (Health/MaxHealth). Show numeric values. Add smooth interpolation for bar movement. Change bar color when health is low (< 25% = pulsing red).' },
    { id: 'au-3', label: 'Create floating enemy health bars', description: 'UWidgetComponent on enemies showing health bar, enemy name, and level.', prompt: 'Create a floating health bar widget for enemies. Use UWidgetComponent attached to enemy characters, set to Screen space. The widget shows: enemy name, level number, health bar that updates on damage. The health bar should fade in when the enemy takes damage and fade out after 3 seconds of no damage. Hide for dead enemies.' },
    { id: 'au-4', label: 'Implement ability cooldown UI', description: 'Ability bar slots show icon, cooldown sweep overlay, mana cost, and keybind label.', prompt: 'Implement the ability bar UI for my aRPG. Create 4 ability slots at the bottom of the screen. Each slot shows: ability icon (UTexture2D from ability data), cooldown sweep overlay (circular wipe that counts down), mana cost number, and the keybind label (1/2/3/4). Bind to GAS ability cooldown tags to drive the sweep animation.' },
    { id: 'au-5', label: 'Create inventory screen', description: 'Grid-based inventory UI with item icons, rarity borders, tooltips on hover, drag-and-drop.', prompt: 'Create the inventory screen UI for my aRPG. Grid layout (6 columns x 5 rows) of item slots. Each slot shows: item icon, stack count badge, rarity-colored border. On hover: show tooltip with item name, description, stats, affixes, rarity. Implement drag-and-drop between inventory slots. Add equipment panel on the left showing paper doll with equipment slots.' },
    { id: 'au-6', label: 'Create character stats screen', description: 'Display all character attributes, equipped item bonuses, and derived stats.', prompt: 'Create a character stats panel for my aRPG. Show all attributes from the AttributeSet: Health/MaxHealth, Mana/MaxMana, Strength, Dexterity, Intelligence, Armor, AttackPower, CriticalChance, CriticalDamage. For each, show base value + bonus from equipment in a different color. Add a section showing damage reduction percentage calculated from Armor.' },
    { id: 'au-7', label: 'Implement floating damage numbers', description: 'Spawn floating text at hit location showing damage amount, colored by type, with animation.', prompt: 'Implement floating damage numbers for my aRPG. When damage is dealt: spawn a UMG widget at the hit location in world space. Show the damage number with color (white=physical, red=fire, blue=ice, yellow=lightning), animate it floating upward and fading out over 1 second. Critical hits show larger text with "CRIT!" prefix. Heal numbers show green with "+" prefix.' },
    { id: 'au-8', label: 'Create pause and settings menus', description: 'Pause menu with Resume, Settings (audio/video), Save, Quit. Settings save to GameUserSettings.', prompt: 'Create a pause menu for my aRPG. On ESC press: pause game (SetGamePaused), show menu with buttons: Resume, Settings, Save Game, Quit to Main Menu. Settings screen with tabs: Graphics (resolution, quality presets, vsync, frame limit), Audio (master/music/sfx volume sliders), Controls (show keybindings). Save settings using UGameUserSettings.' },
  ],
  'arpg-progression': [
    { id: 'ap-1', label: 'Add XP and Level attributes', description: 'Add CurrentXP, XPToNextLevel, CharacterLevel to AttributeSet. Define XP curve per level.', prompt: 'Add progression attributes to my aRPG AttributeSet: CurrentXP (float), XPToNextLevel (float), CharacterLevel (float, treated as int). Create a UCurveTable defining XP required per level (Level 1: 100, Level 2: 250, Level 3: 500... scaling exponentially to Level 50). Set initial values: Level 1, CurrentXP 0, XPToNextLevel from curve.' },
    { id: 'ap-2', label: 'Implement XP award on enemy death', description: 'Dying enemy sends Gameplay Event, player receives XP via Gameplay Effect.', prompt: 'Implement XP rewards for killing enemies. When an enemy dies: send a GameplayEvent to the player (tag: Event.EnemyKilled) with the enemy reference as payload. Create a GE_AwardXP gameplay effect that adds to CurrentXP. The XP amount should be based on enemy level and type (grunt: 10 base, brute: 25 base, boss: 100 base), scaled by level difference.' },
    { id: 'ap-3', label: 'Implement level-up detection', description: 'When XP >= threshold: increment Level, carry over excess XP, grant attribute and skill points.', prompt: 'Implement level-up detection in PostGameplayEffectExecute for the XP attribute. When CurrentXP >= XPToNextLevel: increment CharacterLevel, carry over excess XP (CurrentXP - XPToNextLevel), update XPToNextLevel from curve table, grant AttributePoints (3 per level) and SkillPoints (1 per level). Fire a GameplayEvent for level-up VFX/sound. Check for multiple level-ups from large XP gains.' },
    { id: 'ap-4', label: 'Create active abilities', description: 'Build 4-6 abilities: projectile, AoE slam, dash strike, buff spell, channeled beam.', prompt: 'Create 4 active abilities for my aRPG player beyond basic attack: (1) GA_Fireball - ranged projectile that explodes on impact for AoE fire damage, (2) GA_GroundSlam - AoE slam centered on player dealing physical damage and stunning nearby enemies, (3) GA_DashStrike - dash forward with Motion Warping, damage all enemies in path, (4) GA_WarCry - self-buff increasing AttackPower and Armor for 15 seconds. Each needs montage, VFX placeholder, cooldown, mana cost.' },
    { id: 'ap-5', label: 'Implement ability unlock system', description: 'Spend Skill Points to learn or upgrade abilities. Simple list-based unlock UI.', prompt: 'Create an ability unlock/upgrade system. Define a Data Table of learnable abilities with: AbilityClass, RequiredLevel, SkillPointCost, MaxRank, and per-rank stat increases. Create a UARPGAbilityUnlockComponent that tracks learned abilities and ranks. Implement LearnAbility (spend skill points, grant ability to ASC) and UpgradeAbility (increase rank, apply stronger effect).' },
    { id: 'ap-6', label: 'Implement attribute point allocation', description: 'Spend Attribute Points on Strength/Dex/Int, see derived stats update immediately.', prompt: 'Create attribute point allocation for my aRPG. Track UnspentAttributePoints. Create a UI screen where the player can allocate points to Strength (increases AttackPower), Dexterity (increases CritChance), or Intelligence (increases MaxMana). Each allocation immediately applies a permanent Gameplay Effect. Show the current values and what each point will add.' },
    { id: 'ap-7', label: 'Create ability loadout system', description: 'Player selects which 4 abilities go in hotbar slots. Ability bar reflects loadout.', prompt: 'Implement an ability loadout system. The player has 4 hotbar slots (bound to keys 1-4). From the ability screen, they can assign any learned ability to any slot. Store the loadout as a TMap<int32, TSubclassOf<UGameplayAbility>>. The HUD ability bar reads from this loadout. Activating a hotbar slot activates the assigned ability via the ASC.' },
    { id: 'ap-8', label: 'Test full progression loop', description: 'Kill enemies, gain XP, level up, allocate points, unlock ability, equip to hotbar, use in combat.', prompt: 'Create a test scenario for the full progression loop. Spawn multiple enemy groups. Kill them, verify XP is awarded, level up occurs with VFX/sound. Open character screen, allocate attribute points, verify stat changes. Open ability screen, unlock a new ability with skill points. Assign it to hotbar, use it in combat. Verify the entire loop feels rewarding.' },
  ],
  'arpg-world': [
    { id: 'aw-1', label: 'Design zone layout', description: 'Plan the world structure: Town/Hub, Zone 1 (easy), Zone 2 (medium), Dungeon (hard), Boss Arena.', prompt: 'Help me design the zone layout for my aRPG MVP. I need: (1) Town/Hub - safe area with vendor NPC placeholder, (2) Forest Zone - easy enemies (grunts), level 1-5 content, (3) Ruins Zone - medium enemies (grunts + casters), level 5-10, (4) Catacombs Dungeon - hard enemies (brutes), level 10-15, boss at the end. Create a document outlining each zone with enemy types, level ranges, and key landmarks.' },
    { id: 'aw-2', label: 'Blockout levels', description: 'Create greybox level geometry for all zones using BSP or simple meshes. Establish scale and flow.', prompt: 'Guide me through creating greybox level blockouts for my aRPG zones in UE5. Use simple geometry (cubes, cylinders, BSP) to establish: zone sizes (appropriate for isometric camera), pathway widths, arena sizes for combat encounters, elevation changes, and chokepoints. Focus on the Forest Zone first as a template. Include spawn point placement.' },
    { id: 'aw-3', label: 'Place enemy spawn points', description: 'Add spawn points/volumes per zone, configure enemy types and counts, test encounters.', prompt: 'Place enemy encounters throughout my aRPG zones. For the Forest Zone: place 4-5 encounter areas with EnemySpawnPoint actors, mix of 3-4 grunts per group. Place one mini-boss area. For zone transitions, use trigger volumes that spawn enemies when the player enters. Configure spawn parameters (enemy class, count, respawn timer). Test the encounter flow and pacing.' },
    { id: 'aw-4', label: 'Create interactive world objects', description: 'Build chests, destructible barrels, doors/gates, and NPC interaction points.', prompt: 'Create interactive world objects for my aRPG: (1) Loot Chests (uses loot table, open animation), (2) Destructible Barrels (take damage, break apart, drop gold/potions using Chaos Destruction), (3) Locked Gate (requires key item to open, plays open animation), (4) NPC Interaction Point (proximity prompt, placeholder dialogue). All should be interact-able with the E key.' },
    { id: 'aw-5', label: 'Implement zone transitions', description: 'Level streaming volumes or portal actors that load/unload zone sub-levels seamlessly.', prompt: 'Implement zone transitions for my aRPG using Level Streaming. Each zone is a streaming sub-level. Create portal actors at zone boundaries that trigger level load/unload. Show a brief transition screen while loading. Use ALevelStreamingDynamic for runtime loading. Ensure NavMesh regenerates after level load. Save player position relative to the zone entry point.' },
    { id: 'aw-6', label: 'Create boss encounter', description: 'Design a boss fight with unique behavior tree, multiple phases, special attacks.', prompt: 'Create a boss encounter for my aRPG Catacombs dungeon. The boss (Undead Knight) has: Phase 1 (sword combos, shield block), Phase 2 (below 50% HP, enrages with faster attacks, adds AoE ground slam), Phase 3 (below 25%, summons skeleton adds). Create a unique Behavior Tree with phase transitions, a boss health bar UI at top of screen, and dramatic intro/death sequences.' },
    { id: 'aw-7', label: 'Add environmental hazards', description: 'Fire floors, poison clouds, spike traps that apply Gameplay Effects on overlap.', prompt: 'Create environmental hazards for my aRPG dungeons: (1) Fire Floor - applies periodic fire damage GE while player overlaps, Niagara fire VFX, (2) Poison Cloud - periodic poison damage + slow movement debuff, green particle effect, (3) Spike Trap - triggers on overlap, one-time burst damage, trap animation. All hazards should affect both players and enemies. Use Gameplay Effects for all damage/debuffs.' },
    { id: 'aw-8', label: 'Verify NavMesh and AI pathing', description: 'Place NavMesh bounds, verify AI can path through all zones, fix gaps and problem areas.', prompt: 'Set up and verify navigation for my aRPG zones. Place NavMesh Bounds Volumes covering all playable areas. Run the NavMesh build, check for gaps (especially around stairs, ramps, narrow passages). Verify enemies can path from their spawn points to the player. Check that EQS queries find valid points in each zone. Fix any navigation issues with Nav Modifiers or Nav Link Proxies.' },
  ],
  'arpg-save': [
    { id: 'as-1', label: 'Create USaveGame subclass', description: 'Define save data structure with fields for all persistent state: character, inventory, world.', prompt: 'Create a UARPGSaveGame class extending USaveGame. Define UPROPERTY(SaveGame) fields for: player position/rotation, character level, current XP, attribute allocations, inventory contents (serialized item instances with affixes), equipped items, learned abilities, ability loadout, world state flags (TMap<FName,bool> for chest opened, boss killed, etc.), current zone, and play time.' },
    { id: 'as-2', label: 'Implement custom serialization', description: 'Serialize complex objects (items with random affixes) that UPROPERTY alone cant handle.', prompt: 'Implement custom serialization for my aRPG save system. Items with random affixes need special handling: serialize each UARPGItemInstance as a struct with (ItemDefinition path, StackCount, ItemLevel, array of FItemAffix with tag and magnitude). Create helper functions SerializeInventory/DeserializeInventory that convert between runtime objects and save-friendly structs.' },
    { id: 'as-3', label: 'Implement Save function', description: 'Gather state from all systems (ASC, inventory, progression, world) into SaveGame object.', prompt: 'Implement the Save function for my aRPG. Create a GatherSaveData function that: gets player location from character, reads attributes from ASC (Level, XP, unspent points), serializes inventory and equipment from InventoryComponent, saves learned abilities from AbilityUnlockComponent, saves ability loadout, saves world state flags. Call UGameplayStatics::SaveGameToSlot.' },
    { id: 'as-4', label: 'Implement Load function', description: 'Read SaveGame, distribute data back to all systems, rebuild character state.', prompt: 'Implement the Load function for my aRPG. After reading the USaveGame from slot: set player location, restore attributes via Gameplay Effects, deserialize and rebuild inventory items, re-equip equipment (applying GE stat bonuses), restore learned abilities to ASC, restore ability loadout to hotbar, apply world state flags (mark chests as opened, etc.). Handle missing/corrupted save gracefully.' },
    { id: 'as-5', label: 'Implement auto-save', description: 'Auto-save on zone transitions, boss kills, and level-ups. Use async save.', prompt: 'Implement auto-save for my aRPG. Trigger auto-save on: zone transitions (before loading new zone), boss kill, level-up, and every 5 minutes of play time. Use UGameplayStatics::AsyncSaveGameToSlot for non-blocking saves. Show a brief "Saving..." icon in the HUD corner during auto-save. Use a dedicated auto-save slot separate from manual saves.' },
    { id: 'as-6', label: 'Create save slot system', description: '3 manual save slots plus 1 auto-save slot, each showing character name, level, playtime.', prompt: 'Create a save slot system with 3 manual slots and 1 auto-save slot. Each slot displays: character name, level, playtime, last zone name, and timestamp. Create a SaveSlotWidget showing this info. Implement SaveToSlot (picks slot), LoadFromSlot, DeleteSlot with confirmation dialog. Show empty slots as "Empty Slot" with a "New Game" option.' },
    { id: 'as-7', label: 'Handle save versioning', description: 'Version number in save file for future migration when save format changes.', prompt: 'Add save versioning to my aRPG save system. Add a SaveVersion int32 to the save game class. When loading: check version, if older than current, run migration functions (e.g., v1->v2 adds new fields with defaults). If version is too old or unrecognized, show error message and offer to start new game. Increment version whenever the save format changes.' },
    { id: 'as-8', label: 'Test full save/load cycle', description: 'Play through content, save, quit, reload, verify everything restores exactly.', prompt: 'Create a comprehensive test for the save/load system. Play scenario: equip items, allocate attribute points, unlock ability, open chests, kill boss, level up. Save to slot. Verify save metadata is correct. Quit and reload. Verify: exact player position, all attributes match, inventory contents with affixes intact, equipment applied, abilities unlocked and loadout restored, chests stay opened, boss stays dead.' },
  ],
  'arpg-polish': [
    { id: 'apl-1', label: 'Set up structured logging', description: 'Create custom log categories per system for granular filtering during development.', prompt: 'Set up structured logging for my aRPG. Create custom log categories: LogARPGCombat, LogARPGInventory, LogARPGAI, LogARPGSave, LogARPGAbility using DECLARE_LOG_CATEGORY_EXTERN. Use appropriate verbosity levels (Error for failures, Warning for recoverable issues, Display for important events, Verbose for debug). Add a debug console command to toggle log category verbosity at runtime.' },
    { id: 'apl-2', label: 'Implement debug draw helpers', description: 'Visual debug for collision, AI paths, spawn points, ability ranges using DrawDebugHelpers.', prompt: 'Create debug drawing utilities for my aRPG. Implement toggleable debug visualization for: weapon trace paths (DrawDebugLine), AI perception ranges (DrawDebugSphere), enemy aggro range, NavMesh paths (DrawDebugPath), spawn point locations, ability effect radii. Create a debug console command "arpg.debug [system]" to toggle each visualization independently.' },
    { id: 'apl-3', label: 'Create debug console commands', description: 'Cheat commands for rapid testing: god mode, give item, set level, spawn enemy, kill all.', prompt: 'Create debug console commands for rapid aRPG testing: "arpg.god" (toggle invulnerability), "arpg.giveitem [ItemName] [Count]" (spawn item in inventory), "arpg.setlevel [N]" (set player level), "arpg.addxp [N]" (grant XP), "arpg.spawn [EnemyClass] [Count]" (spawn enemies at crosshair), "arpg.killall" (kill all enemies), "arpg.resetcooldowns" (clear all ability cooldowns). Use UCheatManager subclass.' },
    { id: 'apl-4', label: 'Profile with Unreal Insights', description: 'Use Unreal Insights to identify performance bottlenecks: tick time, draw calls, memory.', prompt: 'Guide me through profiling my aRPG with Unreal Insights. Show how to: enable Trace channels, record a session during combat with many enemies, analyze: game thread time (which actors tick the most), GPU time (draw call count, overdraw), memory usage per asset type. Identify the top 3 bottlenecks and suggest specific fixes for each.' },
    { id: 'apl-5', label: 'Implement object pooling', description: 'Pool frequently spawned actors: projectiles, VFX, damage numbers, loot pickups.', prompt: 'Create an object pooling system for my aRPG. Pool these frequently spawned/destroyed actors: projectiles (instead of spawn/destroy per shot), hit VFX actors, floating damage number widgets, and loot pickup actors. Create a UARPGObjectPool component with GetFromPool/ReturnToPool functions. Pre-warm pools on level start. Show the performance improvement.' },
    { id: 'apl-6', label: 'Optimize tick functions', description: 'Audit all Tick functions, reduce frequency, use timers, disable when not needed.', prompt: 'Audit and optimize tick functions in my aRPG. Identify all actors that override Tick. For AI enemies not near the player: reduce tick frequency or disable tick entirely. Use FTimerManager for periodic checks (health regen, buff expiry) instead of per-frame checks. Disable tick on inactive UI widgets. Show how to use PrimaryActorTick settings to control tick groups and frequency.' },
    { id: 'apl-7', label: 'Set up async asset loading', description: 'Use soft references and async loading for item icons, enemy meshes, VFX to reduce hitches.', prompt: 'Set up async asset loading for my aRPG. Convert hard references to TSoftObjectPtr for: item icons (load when inventory opens), enemy skeletal meshes (load when entering zone), Niagara VFX systems (load on first ability use). Use FStreamableManager::RequestAsyncLoad. Show the loading pattern and how to handle the asset-not-yet-loaded state gracefully.' },
    { id: 'apl-8', label: 'Final integration test', description: 'Play through the complete game flow, verify all systems work together smoothly.', prompt: 'Guide me through a final integration test of my aRPG MVP. Test the complete flow: start new game, explore hub town, enter forest zone, fight enemy groups (verify combat feel), pick up loot, equip better items, level up, allocate points, unlock new ability, continue to ruins, fight boss, save game, reload save and verify everything. Document any issues found.' },
  ],
};

// ─── Quick Actions per aRPG sub-module ────────────────────────────────────────

const ARPG_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  'arpg-character': [
    { id: 'qac-1', label: 'Review Character Setup', prompt: 'Review my character class setup and suggest improvements for movement, input binding, and camera configuration.' },
    { id: 'qac-2', label: 'Fix Movement Issues', prompt: 'Debug and fix common movement issues: character sliding, jittery camera, stuck on geometry, or incorrect rotation.' },
    { id: 'qac-3', label: 'Optimize Input Config', prompt: 'Review and optimize my Enhanced Input setup for responsiveness. Check input mapping contexts, modifiers, and triggers.' },
  ],
  'arpg-animation': [
    { id: 'qaa-1', label: 'Debug Anim Transitions', prompt: 'Debug animation transition issues: blend artifacts, incorrect state transitions, or montage interruption problems.' },
    { id: 'qaa-2', label: 'Add Anim Notify', prompt: 'Create a new custom Anim Notify class in C++ for gameplay events during animations.' },
    { id: 'qaa-3', label: 'Setup Retargeting', prompt: 'Set up animation retargeting to use Mixamo or marketplace animations with my character skeleton.' },
  ],
  'arpg-gas': [
    { id: 'qag-1', label: 'Debug GAS Issue', prompt: 'Help me debug a GAS issue. Show me how to use showdebug abilitysystem and diagnose ability activation or effect application problems.' },
    { id: 'qag-2', label: 'Add New Attribute', prompt: 'Add a new attribute to my AttributeSet with proper clamping, replication, and UI binding.' },
    { id: 'qag-3', label: 'Create Gameplay Effect', prompt: 'Create a new Gameplay Effect with the correct duration policy, modifiers, and execution calculation.' },
  ],
  'arpg-combat': [
    { id: 'qacb-1', label: 'Tune Combat Feel', prompt: 'Review and tune my combat system for better game feel: hitstop timing, camera shake intensity, attack speeds, and damage feedback.' },
    { id: 'qacb-2', label: 'Fix Hit Detection', prompt: 'Debug hit detection issues: traces missing targets, hitting through walls, or inconsistent damage application.' },
    { id: 'qacb-3', label: 'Add New Attack', prompt: 'Create a new attack ability with animation montage, hit detection, damage, and VFX.' },
  ],
  'arpg-enemy-ai': [
    { id: 'qae-1', label: 'Debug AI Behavior', prompt: 'Debug enemy AI behavior: stuck in state, not detecting player, pathfinding issues, or not attacking properly.' },
    { id: 'qae-2', label: 'Create Enemy Type', prompt: 'Create a new enemy archetype with unique behavior tree, abilities, and stats.' },
    { id: 'qae-3', label: 'Tune AI Difficulty', prompt: 'Balance enemy AI difficulty: attack frequency, reaction time, aggro range, damage, and health scaling.' },
  ],
  'arpg-inventory': [
    { id: 'qai-1', label: 'Debug Inventory', prompt: 'Debug inventory issues: items not stacking, equipment stats not applying, or drag-and-drop not working.' },
    { id: 'qai-2', label: 'Add Item Type', prompt: 'Create a new item type definition with appropriate properties, icon, mesh, and gameplay effects.' },
    { id: 'qai-3', label: 'Balance Item Stats', prompt: 'Review and balance item stat ranges for each rarity tier. Ensure progression feels rewarding.' },
  ],
  'arpg-loot': [
    { id: 'qal-1', label: 'Tune Drop Rates', prompt: 'Review and tune loot drop rates: rarity distribution, guaranteed drops from bosses, and gold amounts.' },
    { id: 'qal-2', label: 'Add Loot Table', prompt: 'Create a new loot table for a specific enemy type or zone with appropriate item weights.' },
    { id: 'qal-3', label: 'Balance Affixes', prompt: 'Review and balance the affix system: stat ranges per tier, affix pool diversity, and legendary unique effects.' },
  ],
  'arpg-ui': [
    { id: 'qau-1', label: 'Fix UI Layout', prompt: 'Debug and fix UI layout issues: elements overlapping, incorrect scaling, or not updating in real time.' },
    { id: 'qau-2', label: 'Add UI Screen', prompt: 'Create a new UI screen/panel with proper CommonUI integration and input handling.' },
    { id: 'qau-3', label: 'Polish HUD', prompt: 'Polish the HUD: add animations, improve readability, add contextual elements that appear/disappear based on game state.' },
  ],
  'arpg-progression': [
    { id: 'qap-1', label: 'Balance XP Curve', prompt: 'Review and balance the XP curve: time-to-level-up, XP from different sources, and how it feels at different stages of the game.' },
    { id: 'qap-2', label: 'Add New Ability', prompt: 'Create a new active ability with montage, VFX, damage/effect, cooldown, and mana cost using GAS.' },
    { id: 'qap-3', label: 'Tune Stat Scaling', prompt: 'Balance attribute scaling: how much each point of Strength/Dex/Int affects combat stats, and per-level auto-scaling.' },
  ],
  'arpg-world': [
    { id: 'qaw-1', label: 'Fix NavMesh Issues', prompt: 'Debug and fix navigation mesh problems: AI cant reach areas, pathing through walls, or missing nav coverage.' },
    { id: 'qaw-2', label: 'Design Encounter', prompt: 'Design a new combat encounter for a specific zone with enemy composition, positioning, and difficulty.' },
    { id: 'qaw-3', label: 'Create Boss Fight', prompt: 'Design and implement a boss encounter with multiple phases, unique attacks, and arena mechanics.' },
  ],
  'arpg-save': [
    { id: 'qas-1', label: 'Debug Save/Load', prompt: 'Debug save/load issues: data not persisting, corrupted saves, or state not restoring correctly after load.' },
    { id: 'qas-2', label: 'Add Save Data', prompt: 'Add new data to the save system: define the serialization, update save and load functions, handle migration from old saves.' },
    { id: 'qas-3', label: 'Test Save Migration', prompt: 'Test save version migration: create a save with old version, update format, verify migration restores data correctly.' },
  ],
  'arpg-polish': [
    { id: 'qapl-1', label: 'Profile Performance', prompt: 'Profile my game with Unreal Insights and identify the top performance bottlenecks to fix.' },
    { id: 'qapl-2', label: 'Fix Bug', prompt: 'Help me diagnose and fix a bug in my aRPG. Describe the symptoms and I will help identify the root cause.' },
    { id: 'qapl-3', label: 'Optimize System', prompt: 'Review a specific system for optimization opportunities: reduce tick overhead, pool objects, or async load assets.' },
  ],
};

// ─── aRPG Sub-Module Definitions ──────────────────────────────────────────────

const ARPG_SUB_MODULES: SubModuleDefinition[] = [
  {
    id: 'arpg-character',
    label: 'Character & Movement',
    description: 'Player character, movement, camera, input',
    categoryId: 'core-engine',
    icon: User,
    quickActions: ARPG_QUICK_ACTIONS['arpg-character'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-character'],
  },
  {
    id: 'arpg-animation',
    label: 'Animation System',
    description: 'AnimBP, locomotion, montages, notifies',
    categoryId: 'core-engine',
    icon: Film,
    quickActions: ARPG_QUICK_ACTIONS['arpg-animation'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-animation'],
  },
  {
    id: 'arpg-gas',
    label: 'Ability System (GAS)',
    description: 'ASC, attributes, gameplay effects, tags',
    categoryId: 'core-engine',
    icon: Sparkles,
    quickActions: ARPG_QUICK_ACTIONS['arpg-gas'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-gas'],
  },
  {
    id: 'arpg-combat',
    label: 'Combat System',
    description: 'Melee attacks, combos, hit detection, damage',
    categoryId: 'core-engine',
    icon: Swords,
    quickActions: ARPG_QUICK_ACTIONS['arpg-combat'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-combat'],
  },
  {
    id: 'arpg-enemy-ai',
    label: 'Enemy AI',
    description: 'AI controller, behavior trees, perception',
    categoryId: 'core-engine',
    icon: Bot,
    quickActions: ARPG_QUICK_ACTIONS['arpg-enemy-ai'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-enemy-ai'],
  },
  {
    id: 'arpg-inventory',
    label: 'Items & Inventory',
    description: 'Item data assets, inventory, equipment',
    categoryId: 'core-engine',
    icon: Package,
    quickActions: ARPG_QUICK_ACTIONS['arpg-inventory'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-inventory'],
  },
  {
    id: 'arpg-loot',
    label: 'Loot & Drops',
    description: 'Loot tables, weighted drops, world items',
    categoryId: 'core-engine',
    icon: Gem,
    quickActions: ARPG_QUICK_ACTIONS['arpg-loot'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-loot'],
  },
  {
    id: 'arpg-ui',
    label: 'UI & HUD',
    description: 'Health bars, ability bar, inventory screen',
    categoryId: 'core-engine',
    icon: Monitor,
    quickActions: ARPG_QUICK_ACTIONS['arpg-ui'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-ui'],
  },
  {
    id: 'arpg-progression',
    label: 'Progression',
    description: 'XP, leveling, skill points, ability unlocks',
    categoryId: 'core-engine',
    icon: TrendingUp,
    quickActions: ARPG_QUICK_ACTIONS['arpg-progression'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-progression'],
  },
  {
    id: 'arpg-world',
    label: 'World & Levels',
    description: 'Zone design, enemy placement, bosses',
    categoryId: 'core-engine',
    icon: Map,
    quickActions: ARPG_QUICK_ACTIONS['arpg-world'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-world'],
  },
  {
    id: 'arpg-save',
    label: 'Save & Load',
    description: 'USaveGame, save slots, auto-save',
    categoryId: 'core-engine',
    icon: Save,
    quickActions: ARPG_QUICK_ACTIONS['arpg-save'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-save'],
  },
  {
    id: 'arpg-polish',
    label: 'Polish & Debug',
    description: 'Logging, debug draw, performance tuning',
    categoryId: 'core-engine',
    icon: Bug,
    quickActions: ARPG_QUICK_ACTIONS['arpg-polish'],
    knowledgeTips: [],
    checklist: ARPG_CHECKLISTS['arpg-polish'],
  },
];

// ─── Genre Template Registry ──────────────────────────────────────────────────

const GENRE_TEMPLATES: Partial<Record<GameGenre, SubModuleDefinition[]>> = {
  rpg: ARPG_SUB_MODULES,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getGenreSubModules(genre: GameGenre | null): SubModuleDefinition[] {
  if (!genre) return [];
  return GENRE_TEMPLATES[genre] ?? [];
}

export function getGenreChecklist(subModuleId: string): ChecklistItem[] {
  return ARPG_CHECKLISTS[subModuleId] ?? [];
}

export function getGenreQuickActions(subModuleId: string): QuickAction[] {
  return ARPG_QUICK_ACTIONS[subModuleId] ?? [];
}

/** Map of genre sub-module definitions by ID (for fast lookup) */
const GENRE_SUB_MODULE_MAP: Record<string, SubModuleDefinition> = {};
for (const modules of Object.values(GENRE_TEMPLATES)) {
  if (modules) {
    for (const mod of modules) {
      GENRE_SUB_MODULE_MAP[mod.id] = mod;
    }
  }
}

export function getGenreSubModule(subModuleId: string): SubModuleDefinition | undefined {
  return GENRE_SUB_MODULE_MAP[subModuleId];
}
