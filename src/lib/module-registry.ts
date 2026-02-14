import {
  Activity, ArrowLeftRight, Atom, BarChart3, Bell, Blend,
  Bomb, Bot, Box, Brush, Bug, BugOff,
  CircleDot, CirclePlus, Clapperboard, Code, Compass, Crosshair,
  Crown, Database, Dice5, Eye, FileUp, Film,
  FlaskConical, FolderOpen, Gamepad, Gamepad2, Gauge, Gem,
  Globe, Grid3x3, Import, Joystick, Keyboard, Layers,
  LayoutDashboard, LayoutGrid, LayoutList, ListChecks, Map, MessageCircle,
  MessageSquare, Monitor, MousePointerClick, Music, Network, Package,
  PackagePlus, Paintbrush, Palette, PersonStanding, Plus, PlusCircle,
  Puzzle, Radar, Radio, RefreshCw, Repeat, Rocket,
  RotateCcw, Save, Scale, ScanSearch, SearchCode, Settings,
  Shapes, Shield, ShieldAlert, ShieldCheck, Sliders, Sparkle,
  Sparkles, SunDim, Swords, Table2, Tag, Target,
  Timer, TreeDeciduous, TreePine, TrendingDown, TrendingUp, User,
  UserPlus, Users, Volume2, Workflow, Wrench, Zap,
} from 'lucide-react';
import type { CategoryDefinition, SubModuleDefinition, ChecklistItem, QuickAction } from '@/types/modules';

// ─── Checklist data per aRPG sub-module ───────────────────────────────────────

const ARPG_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'arpg-character': [
    {
      id: 'ac-1',
      label: 'Character foundation package',
      description: 'All-in-one: AARPGCharacterBase (ACharacter subclass), Enhanced Input actions (Move, Look, Interact, PrimaryAttack, Dodge, Sprint) with IMC_Default, AARPGPlayerController with input bindings, Spring Arm + Camera (isometric), and WASD movement with orient-to-movement.',
      prompt: `Create the full character foundation for my aRPG in one pass. This is an all-in-one step — create every file listed below.

1. **AARPGCharacterBase** (Source/Character/) — Abstract ACharacter subclass shared by player and enemies.
   - UCharacterMovementComponent defaults: MaxWalkSpeed 600, MaxAcceleration 2048, RotationRate (0, 540, 0), bOrientRotationToMovement true, bUseControllerRotation* all false.
   - USpringArmComponent (1200 length, -55 pitch, no camera lag) + UCameraComponent for isometric view.
   - Mouse wheel zoom support (clamp spring arm length 600–2000).

2. **Enhanced Input Setup** — Create C++ definitions for Input Actions and an Input Mapping Context:
   - IA_Move (Vector2D), IA_Look (Vector2D), IA_Interact (bool), IA_PrimaryAttack (bool), IA_Dodge (bool), IA_Sprint (bool — hold-to-sprint).
   - IMC_Default binding: WASD → IA_Move, Mouse XY → IA_Look, E → IA_Interact, Left Click → IA_PrimaryAttack, Space → IA_Dodge, Left Shift → IA_Sprint.
   - Register the mapping context in a UInputMappingContext subclass or define as data assets — whichever is simplest to bootstrap in C++.

3. **AARPGPlayerController** (Source/Player/) — Sets up Enhanced Input subsystem, adds IMC_Default, binds all six actions to handler functions. Movement handler applies AddMovementInput relative to camera direction. Character rotates smoothly toward movement via bOrientRotationToMovement.

4. **AARPGPlayerCharacter** (Source/Player/) — Concrete subclass of AARPGCharacterBase for the player. Holds the camera/spring arm. Receives input from the controller.

Verify the build compiles after creating all files.`,
    },
    {
      id: 'ac-2',
      label: 'Implement sprint system',
      description: 'Hold Left Shift to sprint — increase MaxWalkSpeed, adjust camera FOV for speed feel, drain stamina (or simple cooldown if GAS not yet ready).',
      prompt: `Implement a sprint system for my aRPG character.

**Input**: IA_Sprint is already bound to Left Shift as a hold action.

**Behavior**:
- While IA_Sprint is held AND the character is moving: set MaxWalkSpeed to 900 (base is 600).
- When released or character stops: smoothly return to 600 over 0.2s using FInterpTo.
- Adjust camera spring arm length by +100 while sprinting (interpolated) for a subtle pull-back feel.

**Stamina** (simple version, no GAS yet):
- Add a float Stamina (max 100, regen 15/sec when not sprinting).
- Sprinting drains 20 stamina/sec.
- When stamina hits 0, force-stop sprint — character returns to walk speed.
- Show stamina state via a simple log or debug string for now (UI comes later).

**Polish**:
- Add a slight camera FOV increase (+5 degrees) during sprint, interpolated.
- Ensure sprint cancels if the character starts an attack or dodge.

Verify the build compiles.`,
    },
    {
      id: 'ac-3',
      label: 'Implement dodge/dash',
      description: 'Dodge roll on Space — dash in movement direction with velocity impulse, brief invulnerability window, cooldown.',
      prompt: `Implement a dodge roll for my aRPG character.

**Input**: IA_Dodge is bound to Space bar.

**Behavior**:
- On press: dash in the current movement input direction (or backward if no input).
- Use LaunchCharacter or direct velocity set for a quick burst (1200 units over ~0.4s).
- During dodge: apply a bool bIsInvulnerable (or a gameplay tag State.Invulnerable if GAS is set up) for the first 0.3s.
- Dodge has a cooldown of 1.0s — ignore input during cooldown.
- Sprint is cancelled when dodge starts.
- Character rotation snaps to dodge direction at the start.

**Animation placeholder**: For now, just use the movement — animation montage hookup comes in the Animation System module. Leave a clear comment where PlayMontage should be called.

**Stamina interaction**: Dodge costs 25 stamina. If not enough stamina, dodge fails (no action).

Verify the build compiles.`,
    },
    {
      id: 'ac-4',
      label: 'Create GameMode and GameInstance',
      description: 'AARPGGameMode for player spawning with correct pawn/controller classes. UARPGGameInstance for persistent cross-level data.',
      prompt: `Create the game framework classes for my aRPG.

1. **AARPGGameMode** (Source/Framework/):
   - Set DefaultPawnClass to AARPGPlayerCharacter.
   - Set PlayerControllerClass to AARPGPlayerController.
   - Override InitGame or BeginPlay if needed for future setup hooks.

2. **UARPGGameInstance** (Source/Framework/):
   - Subclass of UGameInstance.
   - Add placeholder UPROPERTY fields: int32 PlayerLevel, FString CurrentZone, float TotalPlayTime.
   - Override Init() for any startup logic.
   - This is where persistent cross-level data will live (expanded in Save & Load module).

3. **Update the .uproject or DefaultEngine.ini** — set the default GameMode to AARPGGameMode if possible from C++ (or note that it must be set in Project Settings > Maps & Modes).

Verify the build compiles.`,
    },
    {
      id: 'ac-5',
      label: 'Tune movement feel and terrain handling',
      description: 'Fine-tune acceleration curves, step height, walkable angle, rotation interpolation. Test on ramps, stairs, and ledges.',
      prompt: `Review and tune the character movement for aRPG game feel.

**CharacterMovementComponent tuning**:
- MaxStepHeight: 45 (default is 45, verify it handles standard UE stair meshes).
- MaxWalkableFloorAngle: 50 degrees.
- BrakingDecelerationWalking: 2048 (snappy stop, not floaty).
- GroundFriction: 8.0 (responsive direction changes).
- bCanWalkOffLedges: true.
- FallingLateralFriction: 0.5 (slight air control).
- AirControl: 0.2 (minimal air control for an aRPG).
- JumpZVelocity: 0 (aRPGs typically don't have a jump — if needed later, it's easy to add).

**Rotation tuning**:
- Verify bOrientRotationToMovement gives smooth rotation.
- RotationRate should be high enough (540) that turns feel responsive but not instant.

**Edge cases to verify**:
- Character doesn't slide on slopes below MaxWalkableFloorAngle.
- Character steps up standard stair geometry smoothly.
- Sprint speed increase doesn't cause overshooting on direction changes.
- Dodge velocity doesn't launch character off ledges unexpectedly (or if it does, that's acceptable aRPG behavior).

List any issues found and fix them. Verify build compiles.`,
    },
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
    { id: 'qac-1', label: 'Review Character Setup', prompt: 'Review my character class setup and suggest improvements for movement, input binding, and camera configuration.', icon: ScanSearch, complexity: 'beginner' },
    { id: 'qac-2', label: 'Fix Movement Issues', prompt: 'Debug and fix common movement issues: character sliding, jittery camera, stuck on geometry, or incorrect rotation.', icon: Wrench, complexity: 'intermediate' },
    { id: 'qac-3', label: 'Optimize Input Config', prompt: 'Review and optimize my Enhanced Input setup for responsiveness. Check input mapping contexts, modifiers, and triggers.', icon: Sliders, complexity: 'intermediate' },
  ],
  'arpg-animation': [
    { id: 'qaa-1', label: 'Debug Anim Transitions', prompt: 'Debug animation transition issues: blend artifacts, incorrect state transitions, or montage interruption problems.', icon: ArrowLeftRight, complexity: 'intermediate' },
    { id: 'qaa-2', label: 'Add Anim Notify', prompt: 'Create a new custom Anim Notify class in C++ for gameplay events during animations.', icon: Bell, complexity: 'intermediate' },
    { id: 'qaa-3', label: 'Setup Retargeting', prompt: 'Set up animation retargeting to use Mixamo or marketplace animations with my character skeleton.', icon: PersonStanding, complexity: 'beginner' },
  ],
  'arpg-gas': [
    { id: 'qag-1', label: 'Debug GAS Issue', prompt: 'Help me debug a GAS issue. Show me how to use showdebug abilitysystem and diagnose ability activation or effect application problems.', icon: SearchCode, complexity: 'intermediate' },
    { id: 'qag-2', label: 'Add New Attribute', prompt: 'Add a new attribute to my AttributeSet with proper clamping, replication, and UI binding.', icon: CirclePlus, complexity: 'intermediate' },
    { id: 'qag-3', label: 'Create Gameplay Effect', prompt: 'Create a new Gameplay Effect with the correct duration policy, modifiers, and execution calculation.', icon: Puzzle, complexity: 'advanced' },
  ],
  'arpg-combat': [
    { id: 'qacb-1', label: 'Tune Combat Feel', prompt: 'Review and tune my combat system for better game feel: hitstop timing, camera shake intensity, attack speeds, and damage feedback.', icon: Gauge, complexity: 'intermediate' },
    { id: 'qacb-2', label: 'Fix Hit Detection', prompt: 'Debug hit detection issues: traces missing targets, hitting through walls, or inconsistent damage application.', icon: Crosshair, complexity: 'advanced' },
    { id: 'qacb-3', label: 'Add New Attack', prompt: 'Create a new attack ability with animation montage, hit detection, damage, and VFX.', icon: Plus, complexity: 'intermediate' },
  ],
  'arpg-enemy-ai': [
    { id: 'qae-1', label: 'Debug AI Behavior', prompt: 'Debug enemy AI behavior: stuck in state, not detecting player, pathfinding issues, or not attacking properly.', icon: RotateCcw, complexity: 'intermediate' },
    { id: 'qae-2', label: 'Create Enemy Type', prompt: 'Create a new enemy archetype with unique behavior tree, abilities, and stats.', icon: UserPlus, complexity: 'advanced' },
    { id: 'qae-3', label: 'Tune AI Difficulty', prompt: 'Balance enemy AI difficulty: attack frequency, reaction time, aggro range, damage, and health scaling.', icon: BarChart3, complexity: 'intermediate' },
  ],
  'arpg-inventory': [
    { id: 'qai-1', label: 'Debug Inventory', prompt: 'Debug inventory issues: items not stacking, equipment stats not applying, or drag-and-drop not working.', icon: ShieldAlert, complexity: 'intermediate' },
    { id: 'qai-2', label: 'Add Item Type', prompt: 'Create a new item type definition with appropriate properties, icon, mesh, and gameplay effects.', icon: PackagePlus, complexity: 'beginner' },
    { id: 'qai-3', label: 'Balance Item Stats', prompt: 'Review and balance item stat ranges for each rarity tier. Ensure progression feels rewarding.', icon: Scale, complexity: 'intermediate' },
  ],
  'arpg-loot': [
    { id: 'qal-1', label: 'Tune Drop Rates', prompt: 'Review and tune loot drop rates: rarity distribution, guaranteed drops from bosses, and gold amounts.', icon: TrendingDown, complexity: 'intermediate' },
    { id: 'qal-2', label: 'Add Loot Table', prompt: 'Create a new loot table for a specific enemy type or zone with appropriate item weights.', icon: CircleDot, complexity: 'beginner' },
    { id: 'qal-3', label: 'Balance Affixes', prompt: 'Review and balance the affix system: stat ranges per tier, affix pool diversity, and legendary unique effects.', icon: Settings, complexity: 'advanced' },
  ],
  'arpg-ui': [
    { id: 'qau-1', label: 'Fix UI Layout', prompt: 'Debug and fix UI layout issues: elements overlapping, incorrect scaling, or not updating in real time.', icon: LayoutDashboard, complexity: 'intermediate' },
    { id: 'qau-2', label: 'Add UI Screen', prompt: 'Create a new UI screen/panel with proper CommonUI integration and input handling.', icon: PlusCircle, complexity: 'intermediate' },
    { id: 'qau-3', label: 'Polish HUD', prompt: 'Polish the HUD: add animations, improve readability, add contextual elements that appear/disappear based on game state.', icon: Sparkle, complexity: 'advanced' },
  ],
  'arpg-progression': [
    { id: 'qap-1', label: 'Balance XP Curve', prompt: 'Review and balance the XP curve: time-to-level-up, XP from different sources, and how it feels at different stages of the game.', icon: LayoutList, complexity: 'intermediate' },
    { id: 'qap-2', label: 'Add New Ability', prompt: 'Create a new active ability with montage, VFX, damage/effect, cooldown, and mana cost using GAS.', icon: Paintbrush, complexity: 'advanced' },
    { id: 'qap-3', label: 'Tune Stat Scaling', prompt: 'Balance attribute scaling: how much each point of Strength/Dex/Int affects combat stats, and per-level auto-scaling.', icon: Target, complexity: 'intermediate' },
  ],
  'arpg-world': [
    { id: 'qaw-1', label: 'Fix NavMesh Issues', prompt: 'Debug and fix navigation mesh problems: AI cant reach areas, pathing through walls, or missing nav coverage.', icon: Compass, complexity: 'intermediate' },
    { id: 'qaw-2', label: 'Design Encounter', prompt: 'Design a new combat encounter for a specific zone with enemy composition, positioning, and difficulty.', icon: Shield, complexity: 'intermediate' },
    { id: 'qaw-3', label: 'Create Boss Fight', prompt: 'Design and implement a boss encounter with multiple phases, unique attacks, and arena mechanics.', icon: Crown, complexity: 'advanced' },
  ],
  'arpg-save': [
    { id: 'qas-1', label: 'Debug Save/Load', prompt: 'Debug save/load issues: data not persisting, corrupted saves, or state not restoring correctly after load.', icon: Database, complexity: 'intermediate' },
    { id: 'qas-2', label: 'Add Save Data', prompt: 'Add new data to the save system: define the serialization, update save and load functions, handle migration from old saves.', icon: FileUp, complexity: 'intermediate' },
    { id: 'qas-3', label: 'Test Save Migration', prompt: 'Test save version migration: create a save with old version, update format, verify migration restores data correctly.', icon: FlaskConical, complexity: 'advanced' },
  ],
  'arpg-polish': [
    { id: 'qapl-1', label: 'Profile Performance', prompt: 'Profile my game with Unreal Insights and identify the top performance bottlenecks to fix.', icon: Activity, complexity: 'intermediate' },
    { id: 'qapl-2', label: 'Fix Bug', prompt: 'Help me diagnose and fix a bug in my aRPG. Describe the symptoms and I will help identify the root cause.', icon: BugOff, complexity: 'beginner' },
    { id: 'qapl-3', label: 'Optimize System', prompt: 'Review a specific system for optimization opportunities: reduce tick overhead, pool objects, or async load assets.', icon: Zap, complexity: 'advanced' },
  ],
};

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'project-setup',
    label: 'Project Setup',
    icon: Rocket,
    accentColor: '#00ff88',
    accentColorVar: 'var(--setup)',
    subModules: [],
  },
  {
    id: 'core-engine',
    label: 'Core Engine',
    icon: Code,
    accentColor: '#3b82f6',
    accentColorVar: 'var(--core)',
    subModules: [], // Driven by CORE_ENGINE_IDS
  },
  {
    id: 'content',
    label: 'Content',
    icon: Palette,
    accentColor: '#f59e0b',
    accentColorVar: 'var(--content)',
    subModules: ['models', 'animations', 'materials', 'level-design', 'ui-hud', 'audio'],
  },
  {
    id: 'game-systems',
    label: 'Game Systems',
    icon: Gamepad2,
    accentColor: '#8b5cf6',
    accentColorVar: 'var(--systems)',
    subModules: ['ai-behavior', 'physics', 'multiplayer', 'save-load', 'input-handling', 'dialogue-quests', 'packaging', 'blueprint-transpiler'],
  },
  {
    id: 'evaluator',
    label: 'Evaluator',
    icon: Radar,
    accentColor: '#ef4444',
    accentColorVar: 'var(--evaluator)',
    subModules: ['game-design-doc'],
  },
  {
    id: 'game-director',
    label: 'Game Director',
    icon: Clapperboard,
    accentColor: '#f97316',
    accentColorVar: 'var(--director)',
    subModules: [],
  },
];

// ─── Core Engine module IDs ────────────────────────────────────────────────────────

const CORE_ENGINE_IDS = [
  'arpg-character', 'arpg-animation', 'arpg-gas', 'arpg-combat',
  'arpg-enemy-ai', 'arpg-inventory', 'arpg-loot', 'arpg-ui',
  'arpg-progression', 'arpg-world', 'arpg-save', 'arpg-polish',
] as const;

export const SUB_MODULES: SubModuleDefinition[] = [
  // ── Core Engine (aRPG) ───────────────────────────────────────────────────────────

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
  // ── Content & Game Systems ───────────────────────────────────────────────────────

    // Content
  {
    id: 'models',
    label: '3D Models & Characters',
    description: 'Import pipelines, procedural meshes, data tables',
    categoryId: 'content',
    icon: Box,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'md-1', label: 'Import Pipeline', description: 'FBX/glTF import with materials, LODs, and collision', icon: Import, complexity: 'beginner', prompt: 'Set up an FBX/glTF import pipeline with proper material assignment, LOD setup, and collision generation.' },
      { id: 'md-2', label: 'Procedural Mesh', description: 'Runtime geometry creation for dynamic environments', icon: Shapes, complexity: 'advanced', prompt: 'Create a procedural mesh generation system for runtime geometry creation.' },
      { id: 'md-3', label: 'Data Tables', description: 'Struct definitions and CSV import for stats', icon: Table2, complexity: 'beginner', prompt: 'Design data tables for character/item stats with proper struct definitions and CSV import.' },
    ],
    knowledgeTips: [
      { title: 'Art is the gap', content: 'The feasibility study identified 3D art creation as the biggest gap in AI-assisted UE5 development. Focus on code-side asset management.', source: 'feasibility' },
    ],
    checklist: [
    { id: 'mod-1', label: 'Set up FBX import pipeline', description: 'Configure import settings for skeletal and static meshes from DCC tools.', prompt: 'Set up the FBX import pipeline for my UE5 project. Configure default import settings: for Static Meshes: enable "Generate Lightmap UVs", "Auto Generate Collision", set Normal Import Method to "Import Normals". For Skeletal Meshes: "Import Meshes in Bone Hierarchy", "Import Morph Targets" if using facial animation. Create a Python import script (Editor Scripting) that batch-imports from an "Incoming" folder with consistent naming: SM_[Name] for static, SK_[Name] for skeletal. Set up a naming convention document. Configure source control ignore for raw .blend/.max files.' },
    { id: 'mod-2', label: 'Configure LOD generation', description: 'Set up automatic LOD with screen size thresholds and reduction settings.', prompt: 'Configure LOD for meshes in my UE5 project. For important static meshes: create 3 LOD levels - LOD0 (full detail, screen size >0.5), LOD1 (50% triangles, screen size >0.2), LOD2 (25% triangles, screen size >0.05). In Static Mesh Editor: use "Auto Generate LODs" with reduction settings. For skeletal meshes: use Skeletal Mesh Reduction with bone removal at lower LODs. Set LOD Group in project settings for different asset types (characters, props, foliage). Enable "Force LOD" in viewport to preview each level. Use stat rhi to verify draw call reduction.' },
    { id: 'mod-3', label: 'Set up collision profiles', description: 'Create collision meshes for gameplay: simple for props, complex for architecture.', prompt: 'Set up collision for meshes in my UE5 project. For simple props (barrels, crates): use auto-generated convex collision ("Auto Convex Collision" in mesh editor, max hulls 4-6). For architecture (walls, floors): use "Use Complex Collision as Simple" since geometry matches closely. For characters: use capsule collision on CharacterMovementComponent. For interactables: add separate collision component (box/sphere) as trigger. Create a collision complexity guide: LOD0=complex for raycasts, simplified convex for physics. Verify no holes in collision with "Show Collision" visualization.' },
    { id: 'mod-4', label: 'Enable Nanite for high-poly meshes', description: 'Configure Nanite virtualized geometry for detailed environment meshes.', prompt: 'Enable Nanite for environment meshes in my UE5 project. In Static Mesh Editor: check "Enable Nanite Support" on architecture, rocks, foliage meshes (meshes >10k triangles benefit most). Configure Nanite settings: Fallback Triangle Percent (1% for aggressive reduction), Fallback Relative Error. Do NOT enable Nanite on: skeletal meshes (unsupported), translucent meshes, meshes needing per-pixel custom depth. Set Nanite fallback meshes for platforms without Nanite support. Use stat Nanite console command to verify triangle counts. Verify visual quality at various distances.' },
    { id: 'mod-5', label: 'Create material slots and UV setup', description: 'Organize material slots and verify UV layouts for proper texturing.', prompt: 'Organize material slots and UVs for meshes in my UE5 project. Standardize material slot naming: Slot 0 = "Base" (main surface), Slot 1 = "Trim" (edges/details), Slot 2 = "Emissive" (if needed). In DCC tool: ensure UV0 is for diffuse/normal textures, UV1 for lightmaps (non-overlapping, 0-1 space). In UE5: verify lightmap UVs via "Lightmap Density" viewport mode. Set lightmap resolution per mesh type: architecture 128-256, props 32-64, foliage 0 (dynamic). Use texture atlasing for small props to reduce draw calls.' },
    { id: 'mod-6', label: 'Build asset validation workflow', description: 'Create editor tools to validate mesh quality, naming, and performance budgets.', prompt: 'Create an asset validation workflow for my UE5 project. Write an Editor Utility Widget (Blueprint or Python) that scans all meshes and reports: meshes with no collision, meshes with excessive triangle count (>100k without Nanite), missing LODs on non-Nanite meshes, UV issues (overlapping lightmap UVs), incorrect naming convention (not SM_/SK_ prefix), missing material assignments. Output results as a report widget with Fix buttons where possible (auto-generate collision, auto-generate LODs). Run this validation before packaging to catch issues early.' },
  ],
  },
  {
    id: 'animations',
    label: 'Animations',
    description: 'AnimBP, locomotion states, montages, notifies',
    categoryId: 'content',
    icon: Film,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'an-1', label: 'Anim Blueprint', description: 'State machine for idle, walk, run, jump locomotion', icon: Clapperboard, complexity: 'intermediate', prompt: 'Create an Animation Blueprint with state machine for locomotion (idle, walk, run, jump).' },
      { id: 'an-2', label: 'Montage System', description: 'Attacks, abilities, and contextual action notifies', icon: Layers, complexity: 'advanced', prompt: 'Set up animation montage system for attacks, abilities, and contextual actions with notifies.' },
      { id: 'an-3', label: 'Blend Spaces', description: 'Smooth directional and speed-based transitions', icon: Blend, complexity: 'intermediate', prompt: 'Create blend spaces for smooth movement transitions (directional, speed-based).' },
    ],
    knowledgeTips: [
      { title: 'C++ AnimInstance', content: 'Use C++ AnimInstance for performance-critical animation logic, expose variables to AnimBP for visual state machine.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'anim-1', label: 'Create C++ AnimInstance', description: 'Set up UAnimInstance subclass with movement variables and native update.', prompt: 'Create a C++ UAnimInstance subclass for my UE5 project. Override NativeInitializeAnimation to cache character/movement component references. Override NativeUpdateAnimation to update: float Speed (from velocity magnitude), float Direction (CalculateDirection), bool bIsInAir (IsFalling), bool bIsAccelerating (acceleration > 0), float AimPitch/AimYaw (from control rotation delta). Use UPROPERTY(BlueprintReadOnly) for all variables so AnimBP Blueprint can read them. Avoid using EventGraph in AnimBP - do all logic in C++ NativeUpdate for performance.' },
    { id: 'anim-2', label: 'Build locomotion blend space', description: 'Create 1D or 2D blend space for idle/walk/run transitions.', prompt: 'Create a locomotion Blend Space for my UE5 project. If isometric/third-person: create BS1D_Locomotion (1D Blend Space) with Speed axis 0-600. Sample points: Idle at 0, Walk at 200, Run at 600. Set interpolation to cubic. If strafing needed: create BS2D_Locomotion (2D) with Direction (-180 to 180) on X, Speed (0-600) on Y. Place animations at cardinal directions. In AnimBP: feed Speed and Direction from AnimInstance C++ variables. Verify smooth blending between states with no foot sliding (adjust playrate if needed).' },
    { id: 'anim-3', label: 'Set up animation state machine', description: 'Create states for locomotion, attacking, dodging, hit-react, and death.', prompt: 'Create the main animation state machine in my UE5 project AnimBP. States: Locomotion (plays BS1D_Locomotion), Attacking (montage-driven, auto-transitions back), Dodging (plays dodge montage), HitReact (plays hit react montage), Death (plays death montage, remains in final pose). Transitions: Locomotion->Attacking (on IsMontageActive check), Locomotion->Dodging (on bIsDodging), Any->HitReact (on HitReact montage play), Any->Death (on bIsDead). Set transition blend times: 0.1s for combat transitions, 0.2s for locomotion. Use Transition Rules with C++ AnimInstance booleans.' },
    { id: 'anim-4', label: 'Implement attack montages', description: 'Create attack montage with sections for combo system.', prompt: 'Set up attack montages for my UE5 project. Create AM_MeleeCombo montage with 3 sections: Attack1, Attack2, Attack3. Each section has: anticipation frames (3-5), active frames (weapon trace window), recovery frames (8-12). Add Anim Notifies: AN_ComboWindowOpen/Close (marks window where next input queues), AN_EnableHitDetection/DisableHitDetection, AN_PlaySwingSound, AN_SpawnSwingVFX. In combo system code: on attack input during combo window, call Montage_JumpToSection(NextSection). If no input during window, montage plays recovery and ends. Test timing feels responsive.' },
    { id: 'anim-5', label: 'Create custom Anim Notifies', description: 'Build C++ notify classes for combat events, VFX, and sound.', prompt: 'Create custom C++ Anim Notify classes for my UE5 project. UAnimNotify_PlayNiagaraEffect: spawns Niagara system at socket location. UAnimNotifyState_WeaponTrace: on NotifyBegin starts weapon collision trace, NotifyTick performs per-frame line traces along weapon, NotifyEnd stops traces. Dedup hits with TSet<AActor*>. UAnimNotify_CameraShake: triggers camera shake with configurable intensity. UAnimNotify_PlaySound: plays USoundBase at socket. UAnimNotify_FootstepSound: plays surface-type-dependent footstep (line trace down, check physical material). Register all notifies so they appear in Montage Editor dropdown.' },
    { id: 'anim-6', label: 'Set up animation retargeting', description: 'Configure IK Retargeter for sharing animations between different skeletons.', prompt: 'Set up animation retargeting in my UE5 project. Create UIKRetargeter asset: set Source skeleton (e.g., Mixamo or Mannequin) and Target skeleton (your character). Map bone chains: Spine, LeftArm, RightArm, LeftLeg, RightLeg, Head. Adjust retarget settings: Translation Mode = Globally Scaled for limbs, Skeleton for root. Create RetargetPose matching source T-pose. Batch retarget animations: right-click animation > Retarget > select retargeter and target skeleton. Verify: retargeted locomotion has no foot sliding, attack montages hit at correct height. Fix any bone mapping issues.' },
    { id: 'anim-7', label: 'Test animation integration', description: 'Verify all animation states, transitions, and notifies work with gameplay.', prompt: 'Test the full animation integration in my UE5 project. Verify: (1) Locomotion blends smoothly between idle/walk/run with no pops. (2) Attack combo: press attack 3 times in combo window, verify montage sections chain. (3) Attack outside combo window: verify recovery plays fully. (4) Hit react: take damage during locomotion and during attack, verify hit react interrupts correctly. (5) Death: verify death montage plays and character stays in final pose. (6) Anim notifies: verify swing VFX spawns at weapon socket, sounds play, weapon traces detect hits. (7) No foot sliding during movement.' },
  ],
  },
  {
    id: 'materials',
    label: 'Materials & Shaders',
    description: 'Dynamic materials, post-process, HLSL',
    categoryId: 'content',
    icon: Brush,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'mt-1', label: 'Dynamic Materials', description: 'Runtime color/texture changes via parameter collections', icon: Paintbrush, complexity: 'intermediate', prompt: 'Create a dynamic material system for runtime color/texture changes with material parameter collections.' },
      { id: 'mt-2', label: 'Post-Process', description: 'Bloom, color grading, and custom effect chain', icon: SunDim, complexity: 'intermediate', prompt: 'Set up post-process effects chain with bloom, color grading, and custom effects.' },
      { id: 'mt-3', label: 'Master Material', description: 'Surface-type switches for metal, cloth, skin, etc.', icon: Crown, complexity: 'advanced', prompt: 'Design a master material with switches for different surface types (metal, cloth, skin, etc.).' },
    ],
    knowledgeTips: [
      { title: 'Material instances', content: 'Always use Material Instances for runtime changes. Never modify the parent material directly in-game.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'mat-1', label: 'Create master material', description: 'Build a flexible master material with parameters for PBR workflow.', prompt: 'Create a master material M_Master for my UE5 project. Inputs: BaseColor (Texture2D, default white), Normal (Texture2D, default flat), ORM (Texture2D - Occlusion/Roughness/Metallic packed), Emissive (Texture2D, default black), EmissiveStrength (Scalar, default 0). Add UV tiling parameter (Scalar, default 1). Add detail normal blend with second UV set for close-up detail. Add vertex color support for blending (useful for landscape/terrain). Create Material Instances: MI_Wood, MI_Stone, MI_Metal with appropriate ORM values. Enable Two-Sided option as a static switch.' },
    { id: 'mat-2', label: 'Set up dynamic material instances', description: 'Create runtime-modifiable materials for damage effects, highlights, dissolve.', prompt: 'Create dynamic material systems for my UE5 project. (1) Hit Flash: CreateDynamicMaterialInstance on character mesh, set "HitFlashAmount" parameter to 1.0 on damage, lerp back to 0 over 0.15s using timeline. Add HitFlashAmount * HitFlashColor to emissive in master material. (2) Dissolve: add DissolveCutoff scalar parameter, use with noise texture and step() to clip pixels. Animate 0->1 on death for dissolve effect. (3) Outline/Highlight: set CustomStencilValue on mesh, use post-process material to draw outline around stencil. Create UMaterialParameterCollection for global values (time, wind).' },
    { id: 'mat-3', label: 'Configure material parameter collections', description: 'Set up shared parameters for wind, time, global tint across all materials.', prompt: 'Create UMaterialParameterCollection assets for my UE5 project. MPC_Global: GlobalTime (float, updated from game instance tick), WindDirection (Vector, set by weather system), WindStrength (float), GlobalTintColor (LinearColor, for day/night tinting). MPC_Character: HitFlashIntensity (float). In materials: use CollectionParameter node to read these. In game code: UKismetMaterialLibrary::SetScalarParameterValue/SetVectorParameterValue to update. For wind: apply sine-based vertex offset using WindDirection*WindStrength in foliage/cloth materials. All materials sharing MPC update simultaneously.' },
    { id: 'mat-4', label: 'Build environment material set', description: 'Create material instances for common environment surfaces.', prompt: 'Create an environment material set for my UE5 project using the master material. MI_Stone_Rough: grey basecolor, high roughness (0.85), no metallic. MI_Wood_Floor: wood texture, medium roughness (0.6). MI_Metal_Worn: metallic (0.9), low roughness (0.3), rust mask in vertex color red channel blends to rough non-metallic. MI_Brick: brick basecolor+normal, high roughness (0.8). MI_Glass: translucent blend mode, high specular, low roughness, refraction. MI_Water: translucent, panning normal maps, depth fade. Organize in Content/Materials/Environment/ folder with consistent naming MI_[Surface]_[Variant].' },
    { id: 'mat-5', label: 'Add HLSL custom nodes', description: 'Create custom material expressions for advanced effects.', prompt: 'Create HLSL custom material expressions for my UE5 project. (1) Triplanar mapping: custom node that projects textures from 3 axes based on world normal, blends with sharpness parameter. Use for rocks/terrain that cant have good UVs. (2) Stylized cel-shading: custom node that quantizes lighting into N bands (configurable). (3) Fresnel rim light: custom node with configurable falloff and color for character outlines. (4) Parallax Occlusion Mapping: for deep surface detail on brick/stone without extra geometry. Wire these into material functions (MF_TriplanarProjection, etc.) for reuse across materials.' },
    { id: 'mat-6', label: 'Optimize material performance', description: 'Reduce shader complexity, enable instancing, and profile materials.', prompt: 'Optimize materials in my UE5 project. (1) Enable material instancing: set all varying properties as Material Instance parameters, never modify the parent. (2) Reduce instruction count: check in Material Stats, target <200 instructions for opaque, <100 for translucent. (3) Use static switches instead of dynamic branches for features like two-sided or wind. (4) Use shared samplers to stay under texture sampler limits. (5) Enable "Support Stationary Sky Light" only where needed. (6) Use Material Quality Level to provide simpler versions for low-end. Profile with stat material, stat gpu, and Shader Complexity viewport mode.' },
  ],
  },
  {
    id: 'level-design',
    label: 'Level Design',
    description: 'Living design docs, visual flow editor, bidirectional code sync',
    categoryId: 'content',
    icon: Map,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'ld-1', label: 'Procedural Gen', description: 'Room-corridor generation with connectivity graphs', icon: Dice5, complexity: 'advanced', prompt: 'Implement a procedural level generation system with rooms, corridors, and proper connectivity.' },
      { id: 'ld-2', label: 'Level Streaming', description: 'Load/unload triggers for seamless zone transitions', icon: ArrowLeftRight, complexity: 'intermediate', prompt: 'Set up level streaming with proper loading/unloading triggers and seamless transitions.' },
      { id: 'ld-3', label: 'Spawn System', description: 'Spawn points, waves, and difficulty scaling rules', icon: Target, complexity: 'intermediate', prompt: 'Create a flexible spawn system with spawn points, waves, difficulty scaling, and spawn rules.' },
    ],
    knowledgeTips: [
      { title: 'Procedural generation is strong', content: 'Code-driven level generation is an area where Claude can contribute significantly - algorithms over art.', source: 'feasibility' },
    ],
    checklist: [
    { id: 'ld-1', label: 'Create blockout geometry', description: 'Build greybox levels using BSP brushes or simple meshes to establish scale and flow.', prompt: 'Create blockout geometry for my UE5 project. Using Modeling Tools plugin: create basic shapes (cubes, cylinders, stairs) for level layout. Establish scale: doorways 200x300 units, corridors 300 units wide, rooms 600-1200 units, ceilings 400 units high. Use consistent grid snapping (10 units). Create a greybox material (MI_Greybox) with grid lines showing unit scale. Build: (1) Hub area with exits to 3 directions, (2) Combat arena (circular, 1500 unit diameter), (3) Corridor connecting areas, (4) Vertical section with stairs/ramp. Playtest movement feel and camera angles.' },
    { id: 'ld-2', label: 'Place spawn points and triggers', description: 'Add player start, enemy spawners, and trigger volumes for game events.', prompt: 'Set up spawn points and triggers for my UE5 project levels. Place APlayerStart at level entry. Create AEnemySpawnPoint actor with UPROPERTY: EnemyClass, SpawnCount, RespawnTimer, TriggerVolume reference. When player enters trigger volume: spawn enemies at spawn points. Create trigger types: AreaTrigger (overlap-based), ProximityTrigger (distance check), ConditionalTrigger (checks world state flag). Place: 3-4 enemy encounters in main path, 1 optional side area, 1 boss trigger at end. Add debug visualization showing spawn points and trigger bounds in editor.' },
    { id: 'ld-3', label: 'Implement level streaming', description: 'Set up streaming sub-levels for seamless zone transitions.', prompt: 'Implement level streaming for my UE5 project. Structure: Persistent level (contains only lighting, fog, sky), Sub-levels per zone (Zone_Hub, Zone_Forest, Zone_Dungeon). Use ULevelStreamingDynamic or level streaming volumes. Create transition triggers: when player approaches zone boundary, load next zone (async), when fully loaded, hide loading screen, unload previous zone. Handle streaming states: Loading, Loaded, Visible, Unloaded. Ensure NavMesh works across streamed levels (set "Should be Visible in Level Instance" on NavMesh). Test: walk between zones, verify no hitches >100ms.' },
    { id: 'ld-4', label: 'Configure navigation mesh', description: 'Set up NavMesh bounds, agent settings, and navigation modifiers.', prompt: 'Configure NavMesh for my UE5 project. Place ANavMeshBoundsVolume covering all walkable areas. In Project Settings > Navigation: set Agent Radius 35 (matches capsule), Agent Height 180, Max Step Height 45, Max Slope 45. Add ANavModifierVolume for: no-walk zones (lava, deep water), high-cost zones (mud = cost 3x). Add ANavLinkProxy for: jump-down points, ladder connections between floors. Build NavMesh, verify coverage in NavMesh viewport mode (green = walkable). Fix gaps: add nav mesh generation on simple collision geometry. Verify AI can path from spawn points to all areas.' },
    { id: 'ld-5', label: 'Add environmental storytelling', description: 'Place props, decals, and lighting to create atmosphere and guide players.', prompt: 'Add environmental storytelling to my UE5 project levels. (1) Lighting: brighter paths guide player forward, darker areas suggest danger/secrets. Use point lights for warmth near safe areas, blue/green for hostile zones. (2) Props: barricades and debris suggest past events, weapon racks near combat areas, scattered books near lore NPCs. (3) Decals: blood splatter, scorch marks, cracks in walls for battle damage. (4) Particle effects: dust motes in indoor areas, fireflies outdoor, embers near fire. (5) Breadcrumbing: place collectibles and items along intended path to guide players naturally without explicit markers.' },
    { id: 'ld-6', label: 'Build encounter arenas', description: 'Design combat spaces with cover, elevation, and tactical options.', prompt: 'Design combat encounter arenas for my UE5 project. Principles: (1) Arenas should be 2-3x larger than enemy count suggests for maneuvering. (2) Add 2-3 cover points (pillars, walls, crates) at varied distances. (3) Include elevation changes: raised platform for ranged advantage, pit for risk/reward. (4) Multiple entry/exit points to prevent feeling trapped. (5) Pre-place loot/health pickups as rewards. Create 3 arena templates: Open Arena (circular, 1200 radius, pillars), Corridor Fight (long, narrow, side alcoves), Multi-level Arena (platforms connected by ramps). Each should support different combat strategies.' },
    { id: 'ld-7', label: 'Test level flow and pacing', description: 'Playtest the complete level sequence, verify timing and difficulty curve.', prompt: 'Playtest and evaluate level flow in my UE5 project. Run through the full level sequence and time each section. Target pacing: 30s exploration -> 60s combat -> 15s reward -> repeat, with difficulty ramping. Check: (1) Is the critical path clear? Did you ever get lost? (2) Are combat encounters spaced well (not too close together)? (3) Do arena sizes match enemy counts? (4) Are there "rest stops" between intense sections? (5) Does difficulty increase gradually? (6) Are secrets/optional areas discoverable but not required? Document: time per section, difficulty rating 1-5, any frustration points, suggested changes.' },
  ],
  },
  {
    id: 'ui-hud',
    label: 'UI / HUD',
    description: 'UMG menus, HUD, inventory, settings',
    categoryId: 'content',
    icon: Monitor,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'uh-1', label: 'Main Menu', description: 'Play, settings, and quit using UMG in C++', icon: LayoutGrid, complexity: 'beginner', prompt: 'Create a main menu system with play, settings, and quit buttons using UMG in C++.' },
      { id: 'uh-2', label: 'HUD System', description: 'Health bar, ammo, minimap, and crosshair overlay', icon: LayoutDashboard, complexity: 'intermediate', prompt: 'Implement a game HUD with health bar, ammo counter, minimap, and crosshair using C++ and UMG.' },
      { id: 'uh-3', label: 'Inventory UI', description: 'Grid layout with drag-and-drop and item tooltips', icon: Grid3x3, complexity: 'advanced', prompt: 'Create an inventory UI system with grid layout, drag-and-drop, and item tooltips.' },
      { id: 'uh-4', label: 'Settings Menu', description: 'Graphics, audio, controls tabs with persistence', icon: Settings, complexity: 'beginner', prompt: 'Build a settings menu with graphics, audio, controls tabs and save/load preferences.' },
    ],
    knowledgeTips: [
      { title: 'C++ driven UMG', content: 'Create widgets in C++ and use Blueprint for layout. This gives you type safety and better performance.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'ui-1', label: 'Create main menu widget', description: 'Build the title screen with New Game, Continue, Settings, Quit options.', prompt: 'Create the main menu for my UE5 project using UMG. Create WBP_MainMenu with: game title/logo at top, menu buttons (New Game, Continue, Settings, Quit) centered. Style: dark background with subtle particle effect or animated background. Use CommonUI: UCommonActivatableWidget for menu panels, UCommonButtonBase for buttons with gamepad/keyboard navigation support. "Continue" button: check for save game, grey out if none exists. "Settings" opens settings submenu. "Quit" shows confirmation dialog. Add a smooth camera transition when starting game. Implement button hover sounds and selection feedback.' },
    { id: 'ui-2', label: 'Build HUD framework', description: 'Create the in-game HUD with health bar, mana bar, minimap slot, ability bar.', prompt: 'Create the in-game HUD for my UE5 project using UMG. WBP_GameHUD layout: Bottom-center: ability/hotbar (4-6 slots with cooldown overlay), Top-left: player health bar (gradient red, smooth lerp), player mana bar (blue, below health), Top-right: minimap placeholder (circular frame), Bottom-right: quest objective tracker. Create AHUD subclass that creates the widget. Bind health/mana to GAS attributes using AbilitySystemComponent delegates (OnHealthChanged, OnManaChanged). Health bar shows smooth damage: instant damage + delayed red bar lerp. Add number display next to bars.' },
    { id: 'ui-3', label: 'Implement inventory screen', description: 'Create inventory grid with drag-and-drop, item tooltips, and equipment slots.', prompt: 'Create an inventory screen for my UE5 project. WBP_Inventory: left panel = equipment slots (Head, Chest, Legs, Feet, MainHand, OffHand, Ring x2), center = inventory grid (6x8 slots), right = item details panel. Each slot: item icon, stack count, rarity border color. Implement drag-and-drop: UDragDropOperation with ghost icon following cursor. On drop: swap items, or equip if dropped on equipment slot. Item tooltip on hover: name, rarity, stats, description, "Press E to use". Equipment comparison: show stat diff (green for better, red for worse). Support keyboard/gamepad: D-pad to navigate, A to pick up, X to use.' },
    { id: 'ui-4', label: 'Create floating damage numbers', description: 'Spawn animated text above enemies showing damage dealt with crit/type indicators.', prompt: 'Create floating damage numbers for my UE5 project. On damage dealt: spawn a UWidgetComponent at hit location showing damage value. Animation: float upward (100 units over 1s), fade out, slight random X offset to prevent overlap. Color coding: white for normal, yellow for crit (larger font), red for fire damage, blue for ice, green for poison/heal. For crits: add a slight scale-up bounce animation. Use a widget pool (grab from pool, animate, return after 1s). Create UDamageNumberComponent that attaches to damageable actors and handles spawning. Cap at 5 visible numbers per actor.' },
    { id: 'ui-5', label: 'Build settings menu', description: 'Create video, audio, input settings panels with apply/revert.', prompt: 'Create a settings menu for my UE5 project. WBP_Settings with tabs: Video, Audio, Controls. Video tab: resolution dropdown, window mode (Fullscreen/Windowed/Borderless), quality presets (Low/Medium/High/Epic/Custom), individual settings (shadows, textures, effects, AA, VSync, FPS cap). Use UGameUserSettings to apply and save. Audio tab: Master/Music/SFX/Voice volume sliders, audio device selection. Controls tab: key rebinding list from Enhanced Input, mouse sensitivity slider, invert Y toggle, gamepad sensitivity. Add "Apply", "Revert", "Reset to Default" buttons. Warn about resolution changes with 10s revert timer.' },
    { id: 'ui-6', label: 'Add notification system', description: 'Create toast notifications for quest updates, achievements, loot pickups.', prompt: 'Create a notification/toast system for my UE5 project. WBP_NotificationManager: anchored top-right, stacks notifications vertically. Types: QuestUpdate (yellow border, quest icon), Achievement (gold border, trophy icon), ItemPickup (rarity-colored border, item icon), SystemMessage (grey, info icon). Each notification: slides in from right, stays 3-5s, slides out. Queue system: max 3 visible, new ones push old ones up. API: UNotificationSubsystem::ShowNotification(Type, Title, Description, Icon). Add a subtle sound per type. In combat, batch item pickups: "Picked up 3 items" instead of 3 separate notifications.' },
    { id: 'ui-7', label: 'Test UI across resolutions', description: 'Verify all widgets scale correctly at 1080p, 1440p, and 4K.', prompt: 'Test UI at multiple resolutions in my UE5 project. Set DPI scaling rule in Project Settings > User Interface: "Scale to fit" with custom curve (1.0 at 1080p, 1.5 at 4K). Test at: 1920x1080, 2560x1440, 3840x2160, 1280x720 (Steam Deck). Verify: (1) All text is readable at each resolution. (2) Buttons are clickable with proper hit areas. (3) Inventory grid items are large enough to see. (4) HUD elements dont overlap at low res. (5) Anchoring is correct (health bar stays top-left, minimap stays top-right). (6) Gamepad navigation works with proper focus visualization. Fix any layout breaks.' },
  ],
  },
  {
    id: 'audio',
    label: 'Audio & Music',
    description: 'Spatial audio painter, zone reverb, emitters, sound manager codegen',
    categoryId: 'content',
    icon: Music,
    feasibilityRating: 'moderate',
    quickActions: [
      { id: 'au-1', label: 'Sound Manager', description: 'Audio pooling, fading, and priority management', icon: Volume2, complexity: 'beginner', prompt: 'Create an audio manager component for playing sounds with pooling, fading, and priority.' },
      { id: 'au-2', label: 'Ambient System', description: 'Audio volumes with time-of-day and environment triggers', icon: TreePine, complexity: 'intermediate', prompt: 'Build an ambient sound system with audio volumes, time-of-day variation, and environmental triggers.' },
      { id: 'au-3', label: 'Dynamic Music', description: 'Layered transitions driven by game state changes', icon: Radio, complexity: 'advanced', prompt: 'Implement a dynamic music system that transitions between layers based on game state.' },
    ],
    knowledgeTips: [
      { title: 'MetaSounds', content: 'UE5 MetaSounds provides a node-based audio system. Use C++ to drive parameters, MetaSounds for DSP.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'aud-1', label: 'Create sound manager', description: 'Set up a centralized audio system with sound classes and mix hierarchy.', prompt: 'Create an audio management system for my UE5 project. Set up USoundClass hierarchy: SC_Master > SC_Music, SC_SFX, SC_UI, SC_Voice, SC_Ambient. Create USoundMix: Mix_Default with all at 1.0, Mix_Paused (duck SFX/Ambient to 0.2, Music to 0.5), Mix_Cutscene (duck SFX to 0.3). Create UAudioManagerSubsystem (UGameInstanceSubsystem): PlaySound(SoundBase, Location), PlayMusic(SoundBase), SetVolume(SoundClass, float). Connect volume settings to sound class volumes. Create USoundConcurrency for limiting simultaneous sounds: footsteps max 3, impacts max 5, ambient max 10.' },
    { id: 'aud-2', label: 'Build ambient sound system', description: 'Create ambient sound actors with attenuation and spatial blending.', prompt: 'Create an ambient sound system for my UE5 project. Create AAmbientSoundZone with: UAudioComponent, USphereComponent for blend zone. Configure attenuation: Natural Sound for distance falloff, inner radius (full volume), outer radius (fade to zero). Create ambient soundscapes: Forest (birds, wind, rustling leaves as random SoundCue), Dungeon (dripping water, distant echoes, creaking), Town (crowd murmur, market sounds, distant forge). Use AmbientZone actors: on overlap, crossfade between zone soundscapes over 2 seconds. Add reverb volumes for indoor (cathedral, cave) and outdoor (open, forest) spaces.' },
    { id: 'aud-3', label: 'Implement dynamic music system', description: 'Create an adaptive music system that responds to gameplay state.', prompt: 'Create a dynamic music system for my UE5 project. Music states: Exploration (calm), Combat (intense), Boss (epic), Menu (ambient). Create UMusicManagerSubsystem: tracks current music state, crossfades between tracks (2s fade). On enemy aggro: transition Exploration->Combat. When all enemies dead: Combat->Exploration (5s delay for tension release). Boss encounter: instant switch to Boss track. Each track has: Intro (plays once), Loop (repeats), Outro (plays on state exit). Use UAudioComponent with FadeIn/FadeOut for smooth transitions. Store music state in game state for multiplayer sync.' },
    { id: 'aud-4', label: 'Set up combat audio', description: 'Create weapon sounds, impact sounds, and ability sound effects.', prompt: 'Create combat audio for my UE5 project. Weapon sounds: create USoundCue for each weapon type with randomized variations (3-4 wav files per action) + pitch randomization (0.95-1.05). Sword: swing (whoosh), hit_flesh, hit_metal, hit_wood. Bow: draw, release, arrow_fly (looping attenuated). For impacts: use Physical Material surface type to select sound (metal clang, wood thud, flesh squelch). Ability sounds: charge-up, activate, impact, buff loop. Create 3D spatialization for all combat sounds. Add a slight delay on distant sounds for realism (sound travels slower than VFX).' },
    { id: 'aud-5', label: 'Create MetaSounds graphs', description: 'Build procedural audio using MetaSounds for dynamic sound generation.', prompt: 'Create MetaSounds for my UE5 project. (1) MS_Footstep: takes input Surface Type, Speed. Selects from footstep sample pool based on surface, adjusts pitch/volume based on speed. Adds subtle random variation. (2) MS_EnvironmentWind: procedural wind using noise generators, modulated by global WindStrength parameter. (3) MS_HeartbeatLowHealth: triggered when health < 25%, heartbeat rate increases as health decreases (use LFO with health-mapped frequency). (4) MS_UIClick: procedural click with randomized pitch for variety. Each MetaSound should be self-contained with clear input/output interfaces.' },
    { id: 'aud-6', label: 'Test audio mix and spatialization', description: 'Verify audio balance, 3D positioning, and attenuation across the game.', prompt: 'Test audio in my UE5 project. Walk through all areas and verify: (1) Ambient sounds fade correctly between zones. (2) Music transitions feel natural (no jarring cuts). (3) Combat sounds are punchy and clear above ambient. (4) Footstep surface detection works (different sounds on stone vs wood vs grass). (5) Sound attenuation: distant enemies are quieter, nearby impacts are loud. (6) No audio clipping at high action (reduce concurrent sounds if needed). (7) UI sounds dont spatialize (should be 2D). (8) Volume settings work correctly (slide master to 0, verify silence). Use au.Debug.Sounds to visualize active sounds.' },
  ],
  },
  // Game Systems
  {
    id: 'ai-behavior',
    label: 'AI / NPC Behavior',
    description: 'Behavior trees, EQS, perception, combat AI, scenario-based testing sandbox',
    categoryId: 'game-systems',
    icon: Bot,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ai-1', label: 'Behavior Tree', description: 'Patrol, chase, attack, and retreat state logic', icon: TreeDeciduous, complexity: 'intermediate', prompt: 'Create a behavior tree for an enemy AI with patrol, chase, attack, and retreat behaviors.' },
      { id: 'ai-2', label: 'AI Perception', description: 'Sight, hearing, and damage sense configuration', icon: Eye, complexity: 'beginner', prompt: 'Set up AI perception with sight, hearing, and damage senses with proper stimuli sources.' },
      { id: 'ai-3', label: 'EQS Queries', description: 'Find cover, flanking positions, and patrol points', icon: Compass, complexity: 'advanced', prompt: 'Create Environment Query System queries for finding cover, flanking positions, and patrol points.' },
      { id: 'ai-4', label: 'Combat AI', description: 'Attack patterns, cooldowns, and group coordination', icon: Swords, complexity: 'advanced', prompt: 'Implement combat AI with attack patterns, cooldowns, aggro management, and group coordination.' },
    ],
    knowledgeTips: [
      { title: 'AI is Claude\'s strength', content: 'AI behavior trees and logic are purely code-driven, making this one of the strongest modules for AI assistance.', source: 'feasibility' },
    ],
    checklist: [
    { id: 'ai-1', label: 'Create AI Controller base', description: 'Set up AAIController with blackboard, behavior tree, and perception components.', prompt: 'Create a C++ AAIController subclass for my UE5 project. In constructor: create UAIPerceptionComponent, UBlackboardComponent. In OnPossess: initialize blackboard from behavior tree asset, set "SelfActor" key, start running behavior tree. Create UPROPERTY for default UBehaviorTree asset and UBlackboardData asset. Add helper functions: SetBlackboardTarget(AActor*), GetBlackboardTarget(), ClearBlackboardTarget(). Configure team ID via IGenericTeamAgentInterface for friend/foe detection. Create child blueprints for different enemy types.' },
    { id: 'ai-2', label: 'Build behavior trees', description: 'Create behavior trees with custom BTTask, BTService, and BTDecorator nodes.', prompt: 'Create behavior trees for my UE5 project AI. Start with a patrol/chase/attack tree. Custom nodes: BTTask_FindPatrolPoint (picks random point in radius via EQS), BTTask_MoveToTarget (move to blackboard target with acceptance radius), BTTask_AttackTarget (play attack montage, apply damage). BTService_UpdateTarget (runs every 0.5s, updates nearest enemy via perception). BTDecorator_HasTarget (checks blackboard TargetActor is valid). BTDecorator_IsInRange (checks distance to target < AttackRange). Wire the tree: Selector > [Sequence(HasTarget, IsInRange, Attack), Sequence(HasTarget, MoveToTarget), Sequence(FindPatrolPoint, MoveTo)].' },
    { id: 'ai-3', label: 'Configure AI Perception', description: 'Set up sight, hearing, and damage senses for enemy awareness.', prompt: 'Configure UAIPerceptionComponent for my UE5 project AI. Add sight sense: SightRadius 1500, LoseSightRadius 2000, PeripheralVisionAngle 45, AutoSuccessRange 500. Add hearing sense: HearingRange 1000 (for player footsteps, ability sounds). Add damage sense: auto-detect when receiving damage. In AIController: bind OnTargetPerceptionUpdated delegate. On sense stimulus: if new enemy detected, set as blackboard target. If target lost (out of sight for 5s), clear target and return to patrol. Configure AIStimuliSourceComponent on player character for sight/hearing stimuli.' },
    { id: 'ai-4', label: 'Implement EQS queries', description: 'Create Environment Query System queries for tactical positioning.', prompt: 'Create EQS queries for my UE5 project AI. (1) FindPatrolPoint: SimpleGrid generator (radius 800, spacing 100), test Distance to querier (prefer far), test PathExists (filter unreachable), test Trace to querier (prefer visible). (2) FindFlankPosition: DonutGenerator around target (inner 300, outer 800), test Distance to enemies (prefer far from allies), test PathExists, test Dot to target (prefer side/behind). (3) FindCoverPosition: SimpleGrid around querier (radius 500), test Trace to target (prefer not visible = behind cover), test PathExists. Use EQS queries in BTTask nodes via RunEQSQuery.' },
    { id: 'ai-5', label: 'Add group AI coordination', description: 'Implement squad manager for flanking, surrounding, and focus-fire behaviors.', prompt: 'Create a group AI coordination system for my UE5 project. Create UAISquadManager (UWorldSubsystem): tracks groups of AI (TMap<FName, TArray<AAIController*>>). When 3+ enemies target same player: assign roles (1 engager attacks from front, 1-2 flankers use FindFlankPosition EQS, rest circle at range). Implement RequestAttackToken(AIController) — only 2 enemies attack simultaneously, others wait and reposition. On ally death: reassign roles. On target switch: redistribute group. Add debug draw to visualize squad roles and attack tokens. This prevents "surround and stunlock" feeling.' },
    { id: 'ai-6', label: 'Set up AI debugging tools', description: 'Configure Gameplay Debugger categories and visual logging.', prompt: 'Set up AI debugging tools for my UE5 project. Register custom Gameplay Debugger category for aRPG AI: shows current BT state, active tasks, blackboard values, perception targets, squad role, attack token status. Enable Visual Logger: log perception events, BT transitions, EQS query results with world-space visualization. Add console commands: "ai.debug.showperception" (draw sight cones + hearing range), "ai.debug.showsquad" (draw role assignments + attack tokens), "ai.debug.pausebt" (pause all behavior trees for inspection). Configure key binding for Gameplay Debugger toggle (\' key by default).' },
  ],
  },
  {
    id: 'physics',
    label: 'Physics & Collision',
    description: 'Profiles, materials, projectiles, destruction',
    categoryId: 'game-systems',
    icon: Atom,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ph-1', label: 'Collision Setup', description: 'Define profiles and channels for all actor types', icon: ShieldCheck, complexity: 'beginner', prompt: 'Set up collision profiles and channels for player, enemies, projectiles, and environment.' },
      { id: 'ph-2', label: 'Projectile System', description: 'Physics sim, hit detection, and damage application', icon: Crosshair, complexity: 'intermediate', prompt: 'Create a projectile system with physics simulation, hit detection, and damage application.' },
      { id: 'ph-3', label: 'Destruction', description: 'Chaos Destruction with configurable damage thresholds', icon: Bomb, complexity: 'advanced', prompt: 'Implement a destructible environment system with Chaos Destruction and damage thresholds.' },
    ],
    knowledgeTips: [
      { title: 'Collision channels first', content: 'Define your collision channels and profiles early - refactoring collision later is painful.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'phy-1', label: 'Configure collision profiles', description: 'Set up custom collision channels and profiles for player, enemies, projectiles, interactables.', prompt: 'Set up custom collision profiles for my UE5 project. Create custom Object Channels: Projectile, Interactable, and custom Trace Channels: WeaponTrace, InteractTrace. Define collision profiles in DefaultEngine.ini or via Project Settings > Collision. Set up a profile matrix: Player blocks WorldStatic/WorldDynamic/Pawn, overlaps Projectile; Enemy blocks WorldStatic/Pawn, overlaps Projectile; Projectile overlaps all pawns, ignores other projectiles. Verify with collision visualization in editor.' },
    { id: 'phy-2', label: 'Create physics materials', description: 'Define physical materials for different surface types with friction and restitution.', prompt: 'Create UPhysicalMaterial assets for common surfaces in my UE5 project: PM_Default (friction 0.7, restitution 0.3), PM_Ice (friction 0.1, restitution 0.2), PM_Rubber (friction 1.0, restitution 0.8), PM_Metal (friction 0.4, restitution 0.4), PM_Wood (friction 0.6, restitution 0.3). Set up a Surface Type enum for each. Configure these in the Physical Material assets and assign them to static mesh components. Add surface-type-dependent sound and VFX on impact using Physical Material surface type checks in hit results.' },
    { id: 'phy-3', label: 'Implement projectile system', description: 'Create a projectile base class with UProjectileMovementComponent for ranged attacks.', prompt: 'Create a C++ AProjectileBase class for my UE5 project. Add UProjectileMovementComponent with configurable InitialSpeed (2000), MaxSpeed (2000), bRotationFollowsVelocity, bShouldBounce. Add USphereComponent for collision (radius 10, Projectile profile). On overlap with enemy/player: apply damage via Gameplay Effect, spawn hit VFX (Niagara), play hit sound, destroy self. Add HomingTargetComponent support for homing projectiles. Create child blueprints for arrow, fireball, and poison bolt with different speeds, VFX, and damage types.' },
    { id: 'phy-4', label: 'Set up Chaos Destruction', description: 'Configure destructible meshes using UE5 Chaos system for barrels, crates, walls.', prompt: 'Set up Chaos Destruction in my UE5 project. Create a destructible barrel: take a static mesh, open in Fracture Editor, apply Voronoi fracture with 15-20 chunks. Set damage threshold to 50. Create ADestructibleProp C++ class with UGeometryCollectionComponent. On damage received: trigger fracture, apply radial impulse to chunks, spawn debris VFX, drop loot items. Configure cluster settings for multi-stage destruction (cracks at 25HP, full break at 0HP). Enable "Remove On Max Sleep" to clean up chunks after 5 seconds.' },
    { id: 'phy-5', label: 'Configure physics substepping', description: 'Enable and tune physics substepping for stable simulation at variable framerates.', prompt: 'Configure physics substepping in my UE5 project for stable simulation. In Project Settings > Physics: enable Substepping, set Max Substep Delta Time to 0.01667 (60Hz), Max Substeps to 6. Configure async physics: enable "Enable Async Scene" for better performance. Set Solver Position Iterations to 8 and Velocity Iterations to 1. For character movement: enable "Enable Physics Interaction" on CharacterMovementComponent, set push force factor. Test with stat physics console command to verify stable frame times.' },
    { id: 'phy-6', label: 'Build physics-based interactions', description: 'Implement grab/throw, physics doors, levers, and movable platforms.', prompt: 'Create physics-based interaction objects for my UE5 project. (1) Grab/Throw: UPhysicsHandleComponent on player, line trace to detect grabbable actors, grab on press, throw with impulse on release. (2) Physics Door: UPhysicsConstraintComponent as hinge, angular limits, impulse to open/close. (3) Lever: hinge constraint with angular limit, trigger event at max angle. (4) Moving Platform: InterpToMovement with physics simulation for carried actors. All should use the Interactable collision profile from phy-1.' },
  ],
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    description: 'Replication, RPCs, sessions',
    categoryId: 'game-systems',
    icon: Globe,
    feasibilityRating: 'challenging',
    quickActions: [
      { id: 'mp-1', label: 'Replication Setup', description: 'Replicated properties, conditions, and lifetime', icon: Network, complexity: 'intermediate', prompt: 'Set up basic replication with replicated properties, conditions, and lifetime management.' },
      { id: 'mp-2', label: 'RPC Framework', description: 'Server, Client, and Multicast RPCs with validation', icon: Repeat, complexity: 'advanced', prompt: 'Create a framework for Server, Client, and Multicast RPCs with proper validation.' },
      { id: 'mp-3', label: 'Session System', description: 'Online session creation, discovery, and joining', icon: Users, complexity: 'advanced', prompt: 'Implement online session creation, discovery, and joining using Online Subsystem.' },
    ],
    knowledgeTips: [
      { title: 'Multiplayer is challenging', content: 'The feasibility study rates multiplayer as the most challenging module. Start simple, test with dedicated server early.', source: 'feasibility' },
    ],
    checklist: [
    { id: 'mp-1', label: 'Set up replicated properties', description: 'Mark core gameplay properties as replicated with appropriate conditions.', prompt: 'Set up property replication for my UE5 multiplayer project. In the character class: mark Health, Mana, MovementSpeed as UPROPERTY(ReplicatedUsing=OnRep_Health). Implement GetLifetimeReplicatedProps with DOREPLIFETIME_CONDITION using COND_OwnerOnly for inventory, COND_None for health (everyone sees it). Create OnRep_ functions that update UI/VFX when values change on clients. Mark transform as replicated via CharacterMovementComponent (already built-in). Test with PIE 2-player setup, verify values sync.' },
    { id: 'mp-2', label: 'Implement RPCs', description: 'Create Server, Client, and Multicast RPC functions for gameplay actions.', prompt: 'Implement RPCs for core gameplay actions in my UE5 project. Server RPCs (UFUNCTION(Server, Reliable)): ServerRequestAttack (client requests attack, server validates and executes), ServerUseAbility (validate mana/cooldown on server). Client RPCs (UFUNCTION(Client, Reliable)): ClientReceiveDamage (play hit react on owning client). Multicast RPCs (UFUNCTION(NetMulticast, Unreliable)): MulticastPlayAttackVFX (all clients see attack effects). Implement validation in Server RPCs to prevent cheating. Test with network emulation (200ms latency, 5% packet loss).' },
    { id: 'mp-3', label: 'Configure GameState replication', description: 'Set up AGameStateBase with replicated match state, scores, and player list.', prompt: 'Create a custom AGameState subclass for my UE5 multiplayer game. Replicate: MatchState enum (WaitingForPlayers, InProgress, PostMatch), TimeRemaining (float, replicated), PlayerScores (TArray<FPlayerScore> with PlayerState reference and score). Create custom APlayerState with replicated PlayerName, TeamId, Score, bIsReady. Implement OnRep functions to update lobby/scoreboard UI. Add server authority for state transitions: only server calls SetMatchState(). Test lobby flow: players join, ready up, match starts when all ready.' },
    { id: 'mp-4', label: 'Implement session management', description: 'Create/find/join sessions using UE5 Online Subsystem.', prompt: 'Implement session management for my UE5 multiplayer project using Online Subsystem NULL (for LAN, upgradeable to Steam later). Create UGameSessionManager: CreateSession (host sets map, max players, game mode), FindSessions (search for available games with OnFindSessionsComplete delegate), JoinSession (connect to found session), DestroySession (cleanup on disconnect). Create a Server Browser UI widget listing found sessions with Name, Players, Ping. Add direct IP connect option. Handle connection failures gracefully with error messages.' },
    { id: 'mp-5', label: 'Add client-side prediction', description: 'Implement movement prediction and server reconciliation for responsive gameplay.', prompt: 'Set up client-side prediction for my UE5 multiplayer game. CharacterMovementComponent already handles movement prediction. For abilities: implement a PredictionKey system where client plays ability immediately (predicted), server validates and confirms. On misprediction: rollback client state. For projectiles: client spawns cosmetic-only predicted projectile, server spawns authoritative one. Use FPredictionKey from GAS for ability prediction. Implement a reconciliation buffer for smooth correction. Test with simulated 150ms latency.' },
    { id: 'mp-6', label: 'Implement interest management', description: 'Set up network relevancy to reduce bandwidth by only replicating nearby actors.', prompt: 'Configure interest management for my UE5 multiplayer project. Set NetCullDistanceSquared on actors: enemies at 5000, projectiles at 3000, VFX actors at 2000, players always relevant (bAlwaysRelevant). Override IsNetRelevantFor() on enemy actors to include distance + LOS check. Enable net dormancy (DORM_DormantAll) on static world actors that rarely change. Use NetUpdateFrequency: players at 100Hz, enemies at 30Hz, items at 10Hz. Monitor bandwidth with "net.ListNetPackets" console command.' },
    { id: 'mp-7', label: 'Test full multiplayer flow', description: 'Run a complete multiplayer session: host, join, play, disconnect, rejoin.', prompt: 'Create a comprehensive multiplayer test. Steps: (1) Host creates session, verify server world spawns correctly. (2) Client finds and joins session, verify character spawns and replicates. (3) Both players move around, verify smooth movement replication. (4) Player 1 attacks Player 2, verify damage replicates and both see VFX. (5) Disconnect Player 2, verify cleanup. (6) Player 2 rejoins, verify state restoration. Use PIE with 2 players, then test with packaged build + dedicated server. Document any desync issues.' },
  ],
  },
  {
    id: 'save-load',
    label: 'Save / Load',
    description: 'USaveGame, auto-save, slot system',
    categoryId: 'game-systems',
    icon: Save,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'sl-1', label: 'Save System', description: 'USaveGame serialization for player and world data', icon: Database, complexity: 'beginner', prompt: 'Create a save game system using USaveGame with serialization for player data, world state, and progress.' },
      { id: 'sl-2', label: 'Auto-Save', description: 'Interval-based and checkpoint-triggered async saves', icon: Timer, complexity: 'intermediate', prompt: 'Implement auto-save with configurable intervals, checkpoint triggers, and async saving.' },
      { id: 'sl-3', label: 'Save Slots', description: 'Slot management UI with metadata and deletion', icon: FolderOpen, complexity: 'intermediate', prompt: 'Build a save slot system with slot management UI, metadata display, and delete confirmation.' },
    ],
    knowledgeTips: [
      { title: 'USaveGame is simple', content: 'USaveGame handles serialization for you. Mark properties with UPROPERTY(SaveGame) for automatic inclusion.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'sl-1', label: 'Create USaveGame subclass', description: 'Define the save data structure with UPROPERTY(SaveGame) fields for all persistent state.', prompt: 'Create a USaveGame subclass in C++ for my UE5 project. Include UPROPERTY(SaveGame) fields for: FVector PlayerLocation, FRotator PlayerRotation, int32 PlayerLevel, float CurrentXP, TMap<FName, float> AttributeValues, TArray<FInventoryItemSaveData> InventoryItems (custom struct with ItemDataAsset soft ref, count, affixes), TArray<FName> CompletedQuests, TMap<FName, bool> WorldStateFlags, FString CurrentLevelName, float PlayTimeSeconds, int32 SaveVersion. Add a UPROPERTY for SaveSlotMetadata (name, timestamp, thumbnail).' },
    { id: 'sl-2', label: 'Implement save and load functions', description: 'Gather state from all systems into SaveGame, and restore state from SaveGame.', prompt: 'Implement Save and Load functions for my UE5 project. SaveGame function: gather player transform from character, read attributes from ASC or AttributeSet, serialize inventory from InventoryComponent, save quest progress from QuestSubsystem, save world state flags. Call UGameplayStatics::SaveGameToSlot(SaveGameObject, SlotName, UserIndex). LoadGame function: call UGameplayStatics::LoadGameFromSlot, set player transform, restore attributes via Gameplay Effects, rebuild inventory, restore quests, apply world flags. Handle null/corrupt save gracefully.' },
    { id: 'sl-3', label: 'Implement auto-save system', description: 'Timer-based and event-triggered auto-save with throttling.', prompt: 'Create an auto-save system for my UE5 project. Use FTimerManager to trigger auto-save every 5 minutes. Also trigger on: level transition, boss kill, quest completion. Add a cooldown (minimum 30 seconds between auto-saves) to prevent spam. Use AsyncSaveGameToSlot for non-blocking saves. Show a small spinning icon in HUD corner during save. Use a dedicated "AutoSave" slot separate from manual slots. Log save success/failure to custom log category LogSaveSystem.' },
    { id: 'sl-4', label: 'Create save slot UI', description: 'Save/Load screen with slot list, metadata preview, and delete confirmation.', prompt: 'Create a Save/Load UI for my UE5 project. UMG Widget with: list of 3 manual save slots + 1 auto-save slot (read-only). Each slot shows: slot name, character level, playtime (formatted HH:MM), current zone name, save date. Empty slots show "Empty - Click to Save". Implement SaveToSlot (if slot occupied, show overwrite confirmation), LoadFromSlot, DeleteSlot (with "Are you sure?" dialog). Add a screenshot thumbnail captured at save time using FScreenshotRequest. Style consistently with game UI theme.' },
    { id: 'sl-5', label: 'Handle save versioning', description: 'Version field for forward-compatible save migration.', prompt: 'Add save versioning to my UE5 save system. Add static constexpr int32 CURRENT_SAVE_VERSION = 1 to the save game class. Store SaveVersion in the save data. On load: check SaveVersion. If older, run migration chain (e.g., MigrateV0ToV1 adds new fields with defaults, MigrateV1ToV2 renames/restructures). If version is unrecognized or too old, show error and offer New Game. Implement UARPGSaveGame::Serialize() override for custom binary format if needed. Log migration steps.' },
    { id: 'sl-6', label: 'Test full save/load cycle', description: 'Play through content, save, restart, load, verify everything restores.', prompt: 'Create a test scenario for the save/load system. Play: move to specific location, pick up items, equip gear, advance quest, open a chest (world state flag). Manual save to slot 1. Verify slot metadata displays correctly. Close and restart game. Load slot 1. Verify: exact player position/rotation, inventory contents match (including item properties), equipment applied with stat bonuses, quest progress intact, chest stays opened. Also test: overwriting an existing save, deleting a save, auto-save trigger and load.' },
  ],
  },
  {
    id: 'input-handling',
    label: 'Input Handling',
    description: 'Enhanced Input, rebinding, gamepad',
    categoryId: 'game-systems',
    icon: Joystick,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'ih-1', label: 'Input Setup', description: 'Enhanced Input actions for movement, camera, abilities', icon: Keyboard, complexity: 'beginner', prompt: 'Set up Enhanced Input System with actions for movement, camera, interact, and abilities.' },
      { id: 'ih-2', label: 'Key Rebinding', description: 'Save/load bindings with conflict detection', icon: RefreshCw, complexity: 'intermediate', prompt: 'Implement key rebinding system with save/load of custom bindings and conflict detection.' },
      { id: 'ih-3', label: 'Gamepad Support', description: 'Dead zones, aim assist, and device switching', icon: Gamepad, complexity: 'intermediate', prompt: 'Add gamepad support with proper dead zones, aim assist, and input device detection/switching.' },
    ],
    knowledgeTips: [
      { title: 'Enhanced Input is the standard', content: 'UE5 uses Enhanced Input by default. The old InputComponent system is deprecated.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'ih-1', label: 'Define Enhanced Input Actions', description: 'Create UInputAction assets for all gameplay inputs with correct value types.', prompt: 'Create Enhanced Input Action assets for my UE5 project. Define UInputAction assets: IA_Move (Axis2D for WASD/stick), IA_Look (Axis2D for mouse/right stick), IA_Jump (Digital for spacebar/A button), IA_Interact (Digital for E/X button), IA_PrimaryAttack (Digital for LMB/RT), IA_SecondaryAttack (Digital for RMB/LT), IA_Dodge (Digital for Space/B), IA_Sprint (Digital for Shift/LB), IA_Pause (Digital for Esc/Start), IA_ToggleInventory (Digital for I/Select). Set appropriate ValueTypes (Boolean, Axis1D, Axis2D) for each.' },
    { id: 'ih-2', label: 'Create Input Mapping Context', description: 'Set up UInputMappingContext with keyboard+mouse and gamepad bindings.', prompt: 'Create Input Mapping Contexts for my UE5 project. IMC_Default: bind all gameplay actions with keyboard+mouse and gamepad. Add modifiers: IA_Move uses Negate for S/Down + SwizzleInputAxisValues for A/D. IA_Look uses no modifiers for mouse (raw delta), add Dead Zone modifier for gamepad right stick. Set triggers: IA_Sprint uses Hold trigger, IA_Jump uses Pressed trigger. Create IMC_UI for menu navigation (override game input). Add the IMC to PlayerController via AddMappingContext with priority 0 for default, 1 for UI (higher overrides).' },
    { id: 'ih-3', label: 'Implement key rebinding', description: 'Runtime key rebinding with save/load of custom bindings.', prompt: 'Implement key rebinding for my UE5 project using Enhanced Input Player Mappable Keys. Enable UEnhancedInputUserSettings in Project Settings. Create a Settings UI widget: list all actions with current key, click to enter "Press any key" capture mode using FKey listening. Save custom bindings to UEnhancedInputUserSettings which persists to local profile. Implement ResetToDefaults button. Handle conflicts: if a key is already bound, show "Key already in use for [Action]. Swap?" dialog. Display keyboard glyphs using UCommonInputSubsystem::GetCurrentInputType.' },
    { id: 'ih-4', label: 'Add gamepad support', description: 'Full gamepad bindings with deadzone tuning and platform-specific glyphs.', prompt: 'Add gamepad support to my UE5 project. In IMC_Default: add gamepad bindings alongside keyboard for every action. Configure dead zones: inner 0.2, outer 0.9 for both sticks. Add gamepad-specific modifiers: IA_Look with Scalar modifier (0.5) for right stick to reduce camera speed. Use UCommonInputSubsystem to detect input device changes and swap UI prompts (keyboard icons <-> gamepad icons). Test with Xbox and PlayStation controllers. Add a ControllerType-aware prompt widget that shows correct button glyphs (A/Cross, B/Circle, etc.).' },
    { id: 'ih-5', label: 'Implement input mode management', description: 'Handle transitions between game input, UI input, and combined modes.', prompt: 'Implement input mode management for my UE5 project. Create an InputModeManager in PlayerController with SetInputModeGame() (hide cursor, lock to viewport), SetInputModeUI() (show cursor, unlock), SetInputModeGameAndUI() (show cursor but game input still active for inventory drag). On menu open: push UI mode, add IMC_UI. On menu close: pop back to game mode, remove IMC_UI. Handle edge cases: ESC during gameplay opens pause (UI mode), ESC during menu closes it (game mode). Ensure mouse cursor visibility matches current mode.' },
    { id: 'ih-6', label: 'Test input across scenarios', description: 'Verify inputs work in gameplay, menus, rebinding, and controller switching.', prompt: 'Create a comprehensive input test for my UE5 project. Test: (1) All keyboard+mouse actions during gameplay. (2) Plug in gamepad, verify automatic detection and glyph swap. (3) Open settings, rebind Attack to a different key, verify it works. (4) Open inventory (GameAndUI mode), verify drag-and-drop works while character stays in place. (5) Open pause menu (UI mode), verify game input is disabled. (6) Rapid input device switching (keyboard then gamepad), verify no stuck inputs. (7) Reset bindings to default, verify restoration.' },
  ],
  },
  {
    id: 'dialogue-quests',
    label: 'Dialogue & Quests',
    description: 'Data-driven dialogue, quest tracker',
    categoryId: 'game-systems',
    icon: MessageSquare,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'dq-1', label: 'Dialogue System', description: 'Branching conversations with conditions and triggers', icon: MessageCircle, complexity: 'advanced', prompt: 'Create a data-driven dialogue system with branching conversations, conditions, and consequence triggers.' },
      { id: 'dq-2', label: 'Quest System', description: 'Objectives, tracking, rewards, and quest log UI', icon: ListChecks, complexity: 'advanced', prompt: 'Implement a quest system with objectives, tracking, rewards, and quest log UI.' },
      { id: 'dq-3', label: 'NPC Interaction', description: 'Proximity detection and interaction prompt system', icon: MousePointerClick, complexity: 'beginner', prompt: 'Build an NPC interaction system with proximity detection, interaction prompts, and dialogue triggering.' },
    ],
    knowledgeTips: [
      { title: 'Data tables for dialogue', content: 'Use UE5 Data Tables or custom JSON for dialogue data. Keep content separate from logic for easy iteration.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'dq-1', label: 'Create dialogue data asset', description: 'Define a UPrimaryDataAsset for dialogue trees with nodes, choices, and conditions.', prompt: 'Create a dialogue data system for my UE5 project. Define FDialogueNode struct: Speaker (FName), Text (FText), TArray<FDialogueChoice> Choices (each with Text, NextNodeIndex, Condition GameplayTag). Create UDialogueAsset extending UPrimaryDataAsset with TArray<FDialogueNode> Nodes, EntryNodeIndex. Implement GetNode(Index), GetChoicesForNode(Index, ASC) that filters choices by condition tags. Create a few sample dialogues: blacksmith shop, quest giver, lore NPC.' },
    { id: 'dq-2', label: 'Build conversation UI', description: 'Create a dialogue widget with speaker portrait, text, and choice buttons.', prompt: 'Create a dialogue UI widget for my UE5 project. UMG Widget with: speaker name label, speaker portrait (UTexture2D), dialogue text with typewriter effect (reveal characters over time), choice buttons that appear after text finishes. Style: dark semi-transparent background, text at bottom-center of screen. Implement ShowDialogue(DialogueAsset), AdvanceToNode(Index), SelectChoice(ChoiceIndex). Add keyboard/gamepad navigation for choices (arrow keys + Enter, or D-pad + A). Close on final node (no choices). Emit OnDialogueComplete delegate.' },
    { id: 'dq-3', label: 'Implement quest tracker', description: 'Create a quest subsystem managing active, completed, and failed quests.', prompt: 'Create UQuestSubsystem extending UGameInstanceSubsystem for my UE5 project. Quest data: UQuestDataAsset with QuestName, Description, TArray<FQuestObjective> Objectives, Rewards. FQuestObjective: Type enum (Kill, Collect, Interact, ReachLocation), TargetTag (FGameplayTag), RequiredCount, CurrentCount. Implement AcceptQuest, UpdateObjective (called when game events match objective type+tag), CompleteQuest, AbandonQuest. Fire delegates: OnQuestAccepted, OnObjectiveUpdated, OnQuestCompleted for UI updates. Persist active quest state to save system.' },
    { id: 'dq-4', label: 'Create quest log UI', description: 'Quest log widget with active/completed tabs, objectives, and waypoints.', prompt: 'Create a Quest Log UI for my UE5 project. UMG Widget with two tabs: Active Quests and Completed Quests. Active tab: list of accepted quests, click to expand showing objectives with checkboxes (checked = complete), description text, reward preview. Add "Track" button that places a waypoint marker in the HUD pointing to the quest objective location. Add "Abandon" button with confirmation. Completed tab: list of finished quests with completion timestamp. Style consistently with game UI. Support keyboard/gamepad navigation.' },
    { id: 'dq-5', label: 'Implement NPC interaction', description: 'Create interactable NPC actors with dialogue triggers and role indicators.', prompt: 'Create an AInteractableNPC class for my UE5 project. Components: USphereComponent trigger (radius 200), UWidgetComponent for overhead interaction prompt ("Press E to talk"). UPROPERTY for DialogueAsset reference, NPC Role enum (QuestGiver, Merchant, Lore). On overlap enter: show prompt. On interact (IA_Interact): open dialogue UI with this NPCs dialogue asset. Quest givers show "!" icon when quest available, "?" when quest ready to turn in. Merchants open shop UI after dialogue. Add a simple look-at-player rotation when in conversation.' },
    { id: 'dq-6', label: 'Wire dialogue choices to quest system', description: 'Connect dialogue outcomes to quest acceptance, progression, and rewards.', prompt: 'Connect dialogue to quests in my UE5 project. In dialogue choices: add an OnSelectAction that can call QuestSubsystem functions. "Accept Quest" choice: calls AcceptQuest(QuestAsset). "Turn In Quest" choice: checks HasCompletedAllObjectives, if true calls CompleteQuest and grants rewards (XP, items, gold via GAS effects). Conditional choices: "I have the items" only shows if objective is complete (check GameplayTag condition). Add dialogue-triggered world changes: talking to NPC sets a WorldStateFlag ("TalkedToBlacksmith"). Test a full quest flow: talk to NPC, accept quest, complete objectives, return, turn in.' },
  ],
  },
  {
    id: 'packaging',
    label: 'Packaging',
    description: 'Build config, automation, versioning',
    categoryId: 'game-systems',
    icon: Package,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'pk-1', label: 'Build Config', description: 'Cooking settings, compression, and platform configs', icon: Wrench, complexity: 'beginner', prompt: 'Set up build configuration for shipping with proper cooking settings, compression, and platform configs.' },
      { id: 'pk-2', label: 'Build Automation', description: 'Packaging, testing, and deployment scripts', icon: Workflow, complexity: 'intermediate', prompt: 'Create build automation scripts for packaging, testing, and deployment workflows.' },
      { id: 'pk-3', label: 'Version System', description: 'Build info display and update checking', icon: Tag, complexity: 'beginner', prompt: 'Implement a version numbering system with build info display and update checking.' },
    ],
    knowledgeTips: [
      { title: 'Test shipping builds early', content: 'Package a shipping build early in development to catch packaging issues before they accumulate.', source: 'best-practice' },
    ],
    checklist: [
    { id: 'pkg-1', label: 'Configure build targets', description: 'Set up Development and Shipping build configurations with correct defines.', prompt: 'Configure build targets for my UE5 project. In the .Target.cs files: set DefaultBuildSettings = BuildSettingsVersion.Latest. For Development target: enable bUseLoggingInShipping = false, bUseChecksInShipping = false. For Shipping target: disable all debug features, set BuildConfiguration = EBuildConfiguration.Shipping. In the .Build.cs module: add PublicDefinitions based on build config (e.g., WITH_EDITOR, SHIPPING_BUILD). Set up a Shipping-safe logging macro that compiles out in shipping builds. Verify both targets compile with UBT.' },
    { id: 'pkg-2', label: 'Configure cooking settings', description: 'Set up asset cooking rules, texture compression, and shader permutation reduction.', prompt: 'Configure cooking settings for my UE5 project. In Project Settings > Packaging: set "Build Configuration" to Shipping for release. Under Cooking: enable "Cook only maps" for the maps you need, exclude test/prototype levels. Set texture compression: BC7 for desktop, ASTC for mobile. Reduce shader permutations: disable unused features in material quality levels, set "Shared Material Shader Code" to true. Under "Directories to never cook": add Test/, Prototype/, Debug/ folders. Run a test cook with UAT: "RunUAT BuildCookRun -platform=Win64 -cook -stage -pak" and verify cook log for errors.' },
    { id: 'pkg-3', label: 'Set up platform configuration', description: 'Configure Windows build settings, splash screen, and game icon.', prompt: 'Configure platform settings for my UE5 project. In Project Settings > Windows: set Game Icon (256x256 .ico), Splash Screen image (1920x1080), Company Name, Game Name, Version. Set WindowedFullscreen as default, with resolution auto-detect. Configure prerequisite installer (VC++ Redist). Under Packaging: enable "Use Pak File" for asset packaging, enable "Generate Chunks" for streaming, enable "Build Http Chunk Install Data" if using patching. Set "Staging Directory" for output. Configure DefaultGame.ini with display name and company info.' },
    { id: 'pkg-4', label: 'Create build automation script', description: 'Write a UAT build script for one-click packaging with all steps.', prompt: 'Create a build automation script for my UE5 project. Create a BuildGame.bat (Windows) that runs the full pipeline: (1) Compile game code: call UBT with Development/Shipping config. (2) Cook content: RunUAT BuildCookRun -project=PathToProject.uproject -platform=Win64 -clientconfig=Shipping -cook -stage -pak -archive -archivedirectory=OutputPath. (3) Sign executable if needed. (4) Create version file with build number, git hash, date. Add parameters: -config (Development/Shipping), -clean (full rebuild), -deploy (copy to network share). Log output to BuildLog_[date].txt.' },
    { id: 'pkg-5', label: 'Implement version numbering', description: 'Set up build version tracking with auto-increment and display in-game.', prompt: 'Implement version numbering for my UE5 project. Create a BuildVersion.h with VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH, BUILD_NUMBER macros. Auto-increment BUILD_NUMBER in the build script (read from BuildNumber.txt, increment, write back). Display version string in main menu footer and pause menu: "v1.0.0 (Build 42)". In Shipping builds, also add git short hash: "v1.0.0 (Build 42 - abc1234)". Store version in USaveGame for compatibility checking. Log version at startup for debugging.' },
  ],
  },
  {
    id: 'blueprint-transpiler',
    label: 'BP → C++',
    description: 'Blueprint-to-C++ transpiler with AI diffing',
    categoryId: 'game-systems',
    icon: Code,
    feasibilityRating: 'strong',
    quickActions: [
      { id: 'bpt-1', label: 'Transpile Blueprint', description: 'Convert a Blueprint to equivalent C++ with UPROPERTY/UFUNCTION bindings', icon: ArrowLeftRight, complexity: 'intermediate', prompt: 'Transpile this Blueprint to C++ with proper UE5 conventions.' },
      { id: 'bpt-2', label: 'Semantic Diff', description: 'Compare Blueprint changes against existing C++ to find conflicts', icon: SearchCode, complexity: 'advanced', prompt: 'Run a semantic diff between this Blueprint and the existing C++ implementation.' },
    ],
    knowledgeTips: [
      { title: 'Export Blueprint JSON', content: 'Use UE5 Copy > Paste as JSON or the commandlet to export Blueprint graphs as serializable JSON for transpilation.', source: 'best-practice' },
    ],
    checklist: [],
  },

  // ── Evaluator ───────────────────────────────────────────────────────────────

  {
    id: 'game-design-doc',
    label: 'Game Design Doc',
    description: 'Auto-generated living GDD from project data',
    categoryId: 'evaluator',
    icon: ListChecks,
    feasibilityRating: 'strong',
    quickActions: [],
    knowledgeTips: [
      { title: 'Living document', content: 'The GDD updates automatically from feature matrix, checklist progress, evaluator findings, and build history.', source: 'best-practice' },
    ],
    checklist: [],
  },

];

/** Backwards-compatible filtered view of core-engine modules. */
export const ARPG_SUB_MODULES = SUB_MODULES.filter(m => m.categoryId === 'core-engine');

// ── Unified maps ─────────────────────────────────────────────────────────────────

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<string, CategoryDefinition>;

/** All sub-modules in one map. */
export const SUB_MODULE_MAP: Record<string, SubModuleDefinition> = {};
for (const mod of SUB_MODULES) {
  SUB_MODULE_MAP[mod.id] = mod;
}

export function getSubModulesForCategory(categoryId: string): SubModuleDefinition[] {
  if (categoryId === 'core-engine') {
    return SUB_MODULES.filter(m => CORE_ENGINE_IDS.includes(m.id as typeof CORE_ENGINE_IDS[number]));
  }
  const category = CATEGORY_MAP[categoryId];
  if (!category) return [];
  return category.subModules.map(id => SUB_MODULE_MAP[id]).filter(Boolean);
}

export function getCategoryForSubModule(subModuleId: string): CategoryDefinition | undefined {
  const subModule = SUB_MODULE_MAP[subModuleId];
  if (!subModule) return undefined;
  return CATEGORY_MAP[subModule.categoryId];
}

/** Get checklist for any module. */
export function getModuleChecklist(moduleId: string): ChecklistItem[] {
  return SUB_MODULE_MAP[moduleId]?.checklist ?? [];
}

/** Short labels derived from module definitions. */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(SUB_MODULE_MAP).map(m => [m.id, m.label])
);
