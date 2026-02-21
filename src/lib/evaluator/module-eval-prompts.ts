/**
 * Module-specific evaluation prompts for deep analysis.
 *
 * Each module type gets tailored prompts for 3 passes:
 *   1. Structure — code organization, file layout, class hierarchy
 *   2. Quality — UE5 best practices, anti-patterns, correctness
 *   3. Performance — tick usage, memory, pooling, async patterns
 */

// ─── Pass types ──────────────────────────────────────────────────────────────

import type { SubModuleId } from '@/types/modules';

export type EvalPass = 'structure' | 'quality' | 'performance';

export const EVAL_PASSES: EvalPass[] = ['structure', 'quality', 'performance'];

export const PASS_LABELS: Record<EvalPass, string> = {
  structure: 'Structure',
  quality: 'Quality',
  performance: 'Performance',
};

// ─── Finding output schema (shared across all prompts) ───────────────────────

const FINDING_SCHEMA = `Output ONLY a JSON array of findings. Each finding:
{
  "category": "string — the area of concern",
  "severity": "critical" | "high" | "medium" | "low",
  "file": "relative path from Source/ (or null if general)",
  "line": number | null,
  "description": "what the issue is",
  "suggestedFix": "specific fix description",
  "effort": "trivial" | "small" | "medium" | "large"
}

Rules:
- Output ONLY the JSON array, no markdown, no explanation
- If no findings, output: []
- Be specific about file paths and line numbers when possible
- suggestedFix should be actionable — say exactly what to change`;

// ─── Module-specific context ─────────────────────────────────────────────────

interface ModuleEvalContext {
  /** What this module should contain */
  focus: string;
  /** Module-specific things to check per pass */
  structureChecks: string;
  qualityChecks: string;
  performanceChecks: string;
}

const MODULE_CONTEXTS: Record<string, ModuleEvalContext> = {
  'arpg-character': {
    focus: 'Player character classes, input handling, camera, movement (sprint, dodge)',
    structureChecks: `- AARPGCharacterBase should be abstract with shared logic, not a concrete class
- Player and enemy characters should inherit from base, not duplicate
- Input actions should use Enhanced Input, not legacy
- Camera setup (spring arm + camera) should be on player, not base
- Controller should handle input mapping, not the pawn directly`,
    qualityChecks: `- bOrientRotationToMovement should be true, bUseControllerRotation* false
- Movement component defaults: MaxWalkSpeed, MaxAcceleration, RotationRate
- Sprint should use FInterpTo for smooth speed transitions, not instant set
- Dodge should have invulnerability via gameplay tags, not bool flags
- Stamina drain should integrate with GAS attributes if available`,
    performanceChecks: `- No heavy logic in Tick — movement calculations should use movement component
- Camera zoom should use FInterpTo in Tick, not timeline objects
- Input bindings should not allocate each frame
- Character initialization should not load assets synchronously`,
  },
  'arpg-animation': {
    focus: 'AnimInstance, blend spaces, state machines, montages, notifies, motion warping, Motion Matching (5.7+), IK Retargeter, Mixamo import pipeline',
    structureChecks: `- Should have a C++ AnimInstance base (not pure Blueprint AnimBP)
- State machine should have clear states: Locomotion, Attacking, Dodging, HitReact, Death
- Blend spaces should be separate assets, not inline
- Anim notifies should be C++ classes, not blueprint notifies for gameplay events
- Montages should use sections for combo advancement
- If using Motion Matching (5.7+ experimental): check Motion Matching Chooser Integration for per-asset filtering
- IK Retargeter (5.7+): check for crotch height, floor constraints, stretch chain operators
- If using Mixamo source: skeleton should have "mixamorig:" prefix stripped — bone names should be "Hips" not "mixamorig:Hips"
- Retarget setup should use IK Rigs with proper chain definitions (Spine, LeftArm, RightArm, LeftLeg, RightLeg, Head)`,
    qualityChecks: `- NativeUpdateAnimation should cache movement component values, not call GetOwner() every frame
- Root motion should be toggled per-state (on for attacks, off for locomotion)
- Motion warping targets should be set before montage play, not after
- Anim notify windows should have proper begin/end (UAnimNotifyState)
- Blend space axes should have proper min/max and smoothing
- IK Retargeter should use spatially aware retargeting to prevent limb collision (5.7+)
- Batch retarget should use IKRetargetBatchOperation.duplicate_and_retarget() not manual per-asset retarget
- Mixamo in-place locomotion should NOT have root motion enabled — movement driven by CharacterMovementComponent
- Attack/dodge anims from Mixamo may need RootMotionGeneratorOp post-process if root motion extraction is needed`,
    performanceChecks: `- NativeUpdateAnimation runs every frame — avoid expensive calculations
- Thread-safe proxy should be used for heavy computations
- Avoid GetActorLocation/GetActorRotation in anim tick — cache values
- Montage callbacks should not capture heavy references
- Motion Matching database queries should be profiled — large databases impact perf
- Batch retarget operations should be run as editor utility, not at runtime`,
  },
  'arpg-gas': {
    focus: 'Gameplay Ability System: ASC, AttributeSets, abilities, effects, tags',
    structureChecks: `- ASC should live on character, implement IAbilitySystemInterface
- AttributeSet should be a separate class, not inline on character
- Gameplay tags should follow hierarchy: Ability.*, State.*, Damage.*, Input.*
- Base GameplayAbility should handle cost, cooldown, tag blocking
- Damage calculation should use UGameplayEffectExecutionCalculation`,
    qualityChecks: `- Attributes should have proper clamping in PostGameplayEffectExecute
- Effects should use SetByCaller for variable values, not hardcoded magnitudes
- Tag checking: abilities should block on State.Dead, State.Stunned
- AbilitySystemComponent should be initialized before granting abilities
- Attribute changes should use ATTRIBUTE_ACCESSORS macro`,
    performanceChecks: `- Gameplay effects should prefer instant over infinite where possible
- Avoid creating GE specs in Tick — create once and apply
- Tag queries should be cached, not rebuilt each check
- ASC initialization should not grant all abilities at once in constructor`,
  },
  'arpg-combat': {
    focus: 'Melee attacks, combo system, hit detection, damage, reactions, death',
    structureChecks: `- Melee attack should be a GameplayAbility, not raw code
- Combo system should advance via anim notify, not timer
- Hit detection should use anim notify state windows
- Damage should flow through GAS (GE application), not direct attribute set
- Death flow should use State.Dead tag to block all abilities`,
    qualityChecks: `- Hit detection should use TSet for deduplication (hit each actor once per swing)
- Weapon trace should use sweep, not line trace for accurate melee
- Combo timeout should reset combo count (not just on miss)
- Hit reaction montage should interrupt current montage properly
- Camera shake and hitstop should be proportional to damage`,
    performanceChecks: `- Weapon trace should only run during anim notify window, not every tick
- Damage numbers should use object pooling
- Hit VFX should be spawned from pool, not SpawnEmitter every hit
- Combat events should not broadcast to all actors`,
  },
  'arpg-enemy-ai': {
    focus: 'AI controllers, behavior trees, State Trees (5.7+), perception, EQS, spawn system',
    structureChecks: `- AIController should own BehaviorTree and Blackboard (or State Tree as alternative)
- Perception should have sight and damage senses configured
- BT should have clear states: Idle, Patrol, Chase, Attack, Flee
- Custom BT tasks/services/decorators should be C++ classes
- Enemy character should inherit from AARPGCharacterBase
- If using State Tree (5.7+): states map to BT subtrees, transitions replace decorators, ExecutionRuntimeData for persistent node data`,
    qualityChecks: `- Blackboard keys should be typed (object, vector, bool), not all strings
- BT services should update blackboard, tasks should execute actions
- AI should lose interest after a timeout (not chase forever)
- Perception should have proper sight radius, angle, and age
- Spawn system should respect player proximity limits
- State Tree: use Re-Enter State behavior for looping states, Output Properties for live binding`,
    performanceChecks: `- BT tick interval should be > 0.1s for non-combat AI
- EQS queries should have reasonable item count limits
- Perception should use event-driven, not polling where possible
- Distant enemies should reduce update frequency
- Spawn system should use pooling for frequently spawned enemies
- State Tree Rewind Debugger integration for AI debugging without perf overhead`,
  },
  'arpg-inventory': {
    focus: 'Item definitions, instances, inventory component, equipment, consumables',
    structureChecks: `- Item definition should be UPrimaryDataAsset (data-driven)
- Item instance should be a UObject wrapping the definition
- Inventory should be a UActorComponent with add/remove/find ops
- Equipment slots should use enum, not string keys
- Equip/unequip should flow through GAS effects`,
    qualityChecks: `- Inventory should validate slot bounds and stack limits
- Equipment should apply/remove attribute modifiers correctly
- Item serialization should handle null definitions gracefully
- Consumable use should verify stack count > 0 before applying
- Affix rolling should use weighted random, not uniform`,
    performanceChecks: `- Item icons should use TSoftObjectPtr for lazy loading
- Inventory search should have an index, not O(n) scan
- Equipment changes should batch attribute recalculation
- Item tooltips should cache formatted text`,
  },
  'arpg-loot': {
    focus: 'Loot tables, drop rolling, world items, pickup system',
    structureChecks: `- Loot tables should be data assets with weighted entries
- World items should be actors with mesh, nameplate, rarity beam
- Pickup should check inventory capacity before collecting
- Drop on death should be event-driven, not hardcoded in death flow
- Rarity tiers should drive visual feedback (beam color, nameplate)`,
    qualityChecks: `- Weight normalization should handle zero-weight entries
- Loot table should support nested tables (table-in-table)
- World item should auto-destroy after timeout
- Pickup radius should use overlap, not continuous trace
- Drop positions should avoid overlap with other drops`,
    performanceChecks: `- World items should pool mesh and widget components
- Loot rolling should not allocate during combat
- Nameplate widgets should be hidden when not in view
- Large loot drops should stagger spawn over multiple frames`,
  },
  'arpg-ui': {
    focus: 'HUD, health bars, ability cooldowns, inventory screen, menus',
    structureChecks: `- HUD should use UMG with C++ base classes for game UI
- Health/mana bars should bind to GAS attribute delegates
- Inventory screen should not duplicate inventory logic (use component)
- Floating damage numbers should use a widget pool
- Menus should handle input mode switching properly`,
    qualityChecks: `- Attribute binding should use delegates, not polling in Tick
- UI should handle null/missing data gracefully (empty inventory, no abilities)
- Pause menu should actually pause the game (SetPaused)
- Settings should persist via UGameUserSettings
- Tooltips should show all relevant item/ability info`,
    performanceChecks: `- Damage numbers should use widget pooling, not create/destroy
- Health bars should update on change, not every frame
- Inventory screen should not rebuild all slots on single item change
- Off-screen floating widgets should be collapsed, not just hidden`,
  },
  'arpg-progression': {
    focus: 'XP, leveling, skill points, ability unlocks, attribute allocation',
    structureChecks: `- XP and Level should be GAS attributes
- XP curve should be a UCurveTable data asset
- Level-up should grant skill and attribute points
- Ability unlock should use GAS GrantAbility
- Attribute allocation should apply via permanent GE`,
    qualityChecks: `- XP threshold check should handle multi-level-up (large XP grants)
- Carry-over XP should be preserved on level-up
- Attribute point allocation should be reversible (respec)
- Ability unlock prerequisites should be validated
- Hotbar assignment should persist across sessions`,
    performanceChecks: `- Level-up effects should not recalculate all attributes from scratch
- XP award should be batched if multiple enemies die simultaneously
- Ability UI refresh should be targeted, not full rebuild`,
  },
  'arpg-world': {
    focus: 'Level layout, zone transitions, spawning, boss encounters, hazards',
    structureChecks: `- Levels should use World Partition or level streaming
- Zone transitions should use streaming volumes or portal actors
- Spawn points should be data-driven (not hardcoded positions)
- Boss encounters should have dedicated trigger volumes
- Environmental hazards should use GAS effects for damage`,
    qualityChecks: `- NavMesh should cover all walkable areas
- Zone transitions should preserve player state
- Boss phases should use behavior tree states, not hardcoded sequences
- Hazard damage should respect invulnerability (dodge, etc.)
- Spawn density should scale with zone difficulty`,
    performanceChecks: `- Level streaming should pre-load before player reaches transition
- Distant actors should be dormant
- Environmental VFX should use pooling
- NavMesh should not rebuild at runtime unless necessary`,
  },
  'arpg-save': {
    focus: 'USaveGame, serialization, auto-save, save slots, versioning',
    structureChecks: `- USaveGame should contain all persistent state fields
- Save/load should be centralized (not scattered per-system)
- Auto-save should trigger on significant events
- Save slots should support multiple saves + auto slot
- Save versioning should have migration path`,
    qualityChecks: `- Item instances with affixes should serialize/deserialize correctly
- Save should capture ASC state (attributes, active effects)
- Load should validate data before applying (corrupt save protection)
- Auto-save should not freeze the game (async)
- Save slot metadata should include playtime, level, timestamp`,
    performanceChecks: `- Save should use async writes (SaveGameToSlot is synchronous!)
- Large inventory should not cause save hitches
- Auto-save frequency should be throttled (not on every small change)
- Save file size should be monitored and compressed if needed`,
  },
  'materials': {
    focus: 'Master materials, material instances, Substrate shading (5.7+), material functions, post-process',
    structureChecks: `- Master material should use static switches for feature toggling
- Material instances should inherit from master, not duplicate
- Material functions should be reusable across materials
- Material Parameter Collections for global shared state
- Substrate (5.7+): check if Substrate Slab is used instead of legacy shading models`,
    qualityChecks: `- Dynamic material instances should use UMaterialInstanceDynamic, not direct material edits
- TSoftObjectPtr for base material references (async loading)
- Substrate: unified material graph replaces separate Default Lit/Subsurface/Cloth shading models
- Texture parameters should have sensible defaults
- Material complexity should be monitored (instruction count)`,
    performanceChecks: `- Material instances share compiled shaders — prefer over unique materials
- Static switches compile out unused features at cook time
- Avoid excessive texture samples (combine channels where possible)
- Post-process materials should use early-out for pixels outside effect area
- Substrate materials may have higher baseline cost — profile vs legacy`,
  },
  'ai-behavior': {
    focus: 'AI controllers, behavior trees, State Trees (5.7+), perception, EQS, group coordination',
    structureChecks: `- AIController should own BehaviorTree/Blackboard or State Tree
- Custom BT nodes should be C++ classes
- Perception senses should be configured per AI archetype
- EQS queries should be data assets, not hardcoded
- State Tree (5.7+): hierarchical states with ExecutionRuntimeData for persistent node data`,
    qualityChecks: `- Blackboard keys should be typed, not all strings
- AI should have proper state transitions (idle, alert, combat, flee)
- Perception should have proper sight radius, angle, and age settings
- State Tree: Re-Enter State behavior for looping, Output Properties for live binding
- Group AI should coordinate without tight coupling between agents`,
    performanceChecks: `- BT tick interval should be > 0.1s for non-combat AI
- EQS should have reasonable item count limits
- Perception should be event-driven where possible
- Distant AI should reduce update frequency
- State Tree Rewind Debugger for perf-safe debugging`,
  },
  'arpg-polish': {
    focus: 'Logging, debug tools, object pooling, tick optimization, async loading',
    structureChecks: `- Each system should have its own log category
- Debug commands should be registered via UCheatManager
- Object pooling should use a generic pool component
- Async loading should use FStreamableManager, not LoadObject`,
    qualityChecks: `- Log categories should use DECLARE_LOG_CATEGORY_EXTERN/DEFINE_LOG_CATEGORY
- Debug draw should be conditional on WITH_EDITOR or debug build
- Pool should handle spawn/despawn lifecycle correctly
- Async loads should have proper callbacks and error handling`,
    performanceChecks: `- Tick should be disabled on actors that don't need it
- Distant actors should use reduced tick frequency
- Pooled objects should truly reset state on return to pool
- TSoftObjectPtr should be used for heavy assets (meshes, textures, sounds)`,
  },
};

// ─── Prompt builder ──────────────────────────────────────────────────────────

export interface EvalPromptParams {
  moduleId: SubModuleId;
  pass: EvalPass;
  projectName: string;
  moduleName: string;
  sourcePath: string;
}

export function buildEvalPrompt(params: EvalPromptParams): string {
  const { moduleId, pass, projectName, moduleName, sourcePath } = params;
  const ctx = MODULE_CONTEXTS[moduleId];

  // For modules without specific context, use generic checks
  const focus = ctx?.focus ?? `${moduleId} game system implementation`;
  const passChecks = getPassChecks(ctx, pass);

  const passLabel = PASS_LABELS[pass];

  return `You are evaluating the "${moduleId}" module of UE5 project "${projectName}".

## Focus Area
${focus}

## Evaluation Pass: ${passLabel}
${getPassDescription(pass)}

## What to Check
${passChecks}

## Instructions
1. Read the source files under ${sourcePath} relevant to this module
2. Analyze against the checks listed above
3. For each issue found, note the specific file and line number
4. Rate severity based on impact: critical (crashes/data loss), high (incorrect behavior), medium (suboptimal), low (style/convention)
5. Estimate fix effort: trivial (< 5 min), small (< 30 min), medium (< 2 hours), large (> 2 hours)

${FINDING_SCHEMA}`;
}

function getPassDescription(pass: EvalPass): string {
  switch (pass) {
    case 'structure':
      return 'Analyze code organization, file layout, class hierarchy, and module boundaries. Are classes in the right files? Is the inheritance correct? Are responsibilities properly separated?';
    case 'quality':
      return 'Analyze UE5 best practices, coding conventions, correctness, and anti-patterns. Is the code following Unreal conventions? Are there bugs, incorrect usage, or missed edge cases?';
    case 'performance':
      return 'Analyze performance patterns: tick usage, memory allocation, object pooling, async loading, and scalability. Are there unnecessary per-frame costs? Missing pooling? Synchronous loads?';
  }
}

function getPassChecks(ctx: ModuleEvalContext | undefined, pass: EvalPass): string {
  if (!ctx) {
    switch (pass) {
      case 'structure':
        return '- Check file organization and class hierarchy\n- Verify proper use of UE5 module patterns\n- Check for circular dependencies';
      case 'quality':
        return '- Check UE5 coding conventions (UPROPERTY, UFUNCTION, etc.)\n- Look for common anti-patterns\n- Verify error handling';
      case 'performance':
        return '- Check for unnecessary Tick usage\n- Look for synchronous asset loading\n- Verify object pooling where appropriate';
    }
  }

  switch (pass) {
    case 'structure':
      return ctx.structureChecks;
    case 'quality':
      return ctx.qualityChecks;
    case 'performance':
      return ctx.performanceChecks;
  }
}

/**
 * Returns the list of module IDs that have specialized evaluation contexts.
 */
export function getEvaluableModuleIds(): SubModuleId[] {
  return Object.keys(MODULE_CONTEXTS) as SubModuleId[];
}

/**
 * Check if a module has specialized evaluation prompts.
 */
export function hasModuleContext(moduleId: SubModuleId): boolean {
  return moduleId in MODULE_CONTEXTS;
}
