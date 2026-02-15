/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Sample Crash Data                            */
/* ------------------------------------------------------------------ */

import type {
  CrashReport,
  CrashDiagnosis,
  CallstackFrame,
  MachineState,
  CrashType,
  CrashSeverity,
} from '@/types/crash-analyzer';

/* ---- Default machine state --------------------------------------- */

const DEFAULT_MACHINE: MachineState = {
  platform: 'Windows',
  cpuBrand: 'AMD Ryzen 9 5900X',
  gpuBrand: 'NVIDIA GeForce RTX 3080',
  ramMB: 32768,
  osVersion: 'Windows 11 Pro 10.0.26200',
  engineVersion: '5.5.0',
  buildConfig: 'Development',
  isEditor: true,
};

/* ---- Helpers ----------------------------------------------------- */

function frame(
  index: number,
  mod: string,
  fn: string,
  file: string | null,
  line: number | null,
  isGame: boolean,
  isCrash = false,
): CallstackFrame {
  return {
    index,
    address: `0x00007FF6${(0xA0000000 + index * 0x1234).toString(16).toUpperCase()}`,
    moduleName: mod,
    functionName: fn,
    sourceFile: file,
    lineNumber: line,
    isGameCode: isGame,
    isCrashOrigin: isCrash,
  };
}

/* ---- Sample crashes ---------------------------------------------- */

export const SAMPLE_CRASHES: CrashReport[] = [
  /* ── 1. Null ASC on ability activation ───────────────────────── */
  {
    id: 'crash-001',
    timestamp: '2026-02-14T22:15:33Z',
    crashType: 'nullptr_deref',
    severity: 'critical',
    errorMessage: 'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
    callstack: [
      frame(0, 'UnrealEditor-Engine', 'FDebug::AssertFailed', null, null, false),
      frame(1, 'UnrealEditor-Engine', 'UAbilitySystemComponent::TryActivateAbility', null, null, false),
      frame(2, 'UnrealEditor-MyGame', 'AARPGCharacterBase::ActivateAbility', 'Source/Character/ARPGCharacterBase.cpp', 234, true, true),
      frame(3, 'UnrealEditor-MyGame', 'AARPGCharacterBase::HandleInputAction_Ability1', 'Source/Character/ARPGCharacterBase.cpp', 189, true),
      frame(4, 'UnrealEditor-Engine', 'UEnhancedInputComponent::ProcessInputAction', null, null, false),
      frame(5, 'UnrealEditor-Engine', 'APlayerController::ProcessPlayerInput', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-22.15.33',
    mappedModule: null,
    rawLog: `[2026.02.14-22.15.33:456][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000
[2026.02.14-22.15.33:456][  0]LogWindows: Error:
[2026.02.14-22.15.33:456][  0]LogWindows: Error: [Callstack]
[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-Engine!FDebug::AssertFailed()
[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-Engine!UAbilitySystemComponent::TryActivateAbility()
[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-MyGame!AARPGCharacterBase::ActivateAbility() [ARPGCharacterBase.cpp:234]
[2026.02.14-22.15.33:456][  0]LogWindows: Error: UnrealEditor-MyGame!AARPGCharacterBase::HandleInputAction_Ability1() [ARPGCharacterBase.cpp:189]`,
    analyzed: false,
  },

  /* ── 2. GAS ability during death flow ────────────────────────── */
  {
    id: 'crash-002',
    timestamp: '2026-02-14T21:42:17Z',
    crashType: 'assertion_failed',
    severity: 'high',
    errorMessage: 'Assertion failed: AbilitySpec != nullptr [UAbilitySystemComponent::InternalTryActivateAbility]',
    callstack: [
      frame(0, 'UnrealEditor-Core', 'FDebug::LogAssertFailedMessage', null, null, false),
      frame(1, 'UnrealEditor-Engine', 'UAbilitySystemComponent::InternalTryActivateAbility', null, null, false),
      frame(2, 'UnrealEditor-MyGame', 'UARPGAbilitySystemComponent::OnDeathStarted', 'Source/GAS/ARPGAbilitySystemComponent.cpp', 87, true, true),
      frame(3, 'UnrealEditor-MyGame', 'AARPGCharacterBase::HandleDeath', 'Source/Character/ARPGCharacterBase.cpp', 312, true),
      frame(4, 'UnrealEditor-MyGame', 'UARPGHealthComponent::OnHealthChanged', 'Source/Components/ARPGHealthComponent.cpp', 45, true),
      frame(5, 'UnrealEditor-Engine', 'UAbilitySystemComponent::OnAttributeValueChanged', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-21.42.17',
    mappedModule: null,
    rawLog: `[2026.02.14-21.42.17:891][  0]LogOutputDevice: Error: Assertion failed: AbilitySpec != nullptr
[2026.02.14-21.42.17:891][  0]LogOutputDevice: Error: [File:AbilitySystemComponent.cpp] [Line: 2341]
[2026.02.14-21.42.17:891][  0]LogOutputDevice: Error: UAbilitySystemComponent::InternalTryActivateAbility
[2026.02.14-21.42.17:891][  0]LogOutputDevice: Error:
[2026.02.14-21.42.17:891][  0]LogWindows: Error: [Callstack]
[2026.02.14-21.42.17:891][  0]LogWindows: Error: UnrealEditor-MyGame!UARPGAbilitySystemComponent::OnDeathStarted() [ARPGAbilitySystemComponent.cpp:87]`,
    analyzed: false,
  },

  /* ── 3. Null check missing on loot table ─────────────────────── */
  {
    id: 'crash-003',
    timestamp: '2026-02-14T20:08:44Z',
    crashType: 'nullptr_deref',
    severity: 'critical',
    errorMessage: 'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048',
    callstack: [
      frame(0, 'UnrealEditor-Engine', 'FDebug::AssertFailed', null, null, false),
      frame(1, 'UnrealEditor-MyGame', 'UARPGLootManager::RollLootTable', 'Source/Loot/ARPGLootManager.cpp', 156, true, true),
      frame(2, 'UnrealEditor-MyGame', 'AARPGEnemyCharacter::DropLoot', 'Source/AI/ARPGEnemyCharacter.cpp', 203, true),
      frame(3, 'UnrealEditor-MyGame', 'AARPGEnemyCharacter::OnDeath', 'Source/AI/ARPGEnemyCharacter.cpp', 178, true),
      frame(4, 'UnrealEditor-Engine', 'UAbilitySystemComponent::ExecuteGameplayCue', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-20.08.44',
    mappedModule: null,
    rawLog: `[2026.02.14-20.08.44:123][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048
[2026.02.14-20.08.44:123][  0]LogWindows: Error: [Callstack]
[2026.02.14-20.08.44:123][  0]LogWindows: Error: UnrealEditor-MyGame!UARPGLootManager::RollLootTable() [ARPGLootManager.cpp:156]
[2026.02.14-20.08.44:123][  0]LogWindows: Error: UnrealEditor-MyGame!AARPGEnemyCharacter::DropLoot() [ARPGEnemyCharacter.cpp:203]`,
    analyzed: false,
  },

  /* ── 4. GC reference crash in inventory ──────────────────────── */
  {
    id: 'crash-004',
    timestamp: '2026-02-14T19:30:12Z',
    crashType: 'gc_reference',
    severity: 'high',
    errorMessage: 'Attempting to access garbage collected UObject: UARPGItemInstance',
    callstack: [
      frame(0, 'UnrealEditor-CoreUObject', 'UObject::IsValidLowLevel', null, null, false),
      frame(1, 'UnrealEditor-MyGame', 'UARPGInventoryComponent::GetItemAtSlot', 'Source/Inventory/ARPGInventoryComponent.cpp', 89, true, true),
      frame(2, 'UnrealEditor-MyGame', 'UARPGInventoryWidget::RefreshSlots', 'Source/UI/ARPGInventoryWidget.cpp', 134, true),
      frame(3, 'UnrealEditor-UMG', 'UUserWidget::NativeTick', null, null, false),
      frame(4, 'UnrealEditor-Engine', 'FSlateApplication::Tick', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-19.30.12',
    mappedModule: null,
    rawLog: `[2026.02.14-19.30.12:567][  0]LogUObjectGlobals: Error: Attempting to access garbage collected UObject: UARPGItemInstance
[2026.02.14-19.30.12:567][  0]LogWindows: Error: [Callstack]
[2026.02.14-19.30.12:567][  0]LogWindows: Error: UnrealEditor-MyGame!UARPGInventoryComponent::GetItemAtSlot() [ARPGInventoryComponent.cpp:89]`,
    analyzed: false,
  },

  /* ── 5. Save/load deserialization crash ──────────────────────── */
  {
    id: 'crash-005',
    timestamp: '2026-02-14T18:15:28Z',
    crashType: 'fatal_error',
    severity: 'medium',
    errorMessage: 'Fatal error: FArchive::Serialize: Attempt to serialize data with a corrupt archive',
    callstack: [
      frame(0, 'UnrealEditor-Core', 'FArchive::Serialize', null, null, false),
      frame(1, 'UnrealEditor-MyGame', 'UARPGSaveGame::DeserializeInventory', 'Source/SaveLoad/ARPGSaveGame.cpp', 203, true, true),
      frame(2, 'UnrealEditor-MyGame', 'UARPGSaveGameSubsystem::LoadGame', 'Source/SaveLoad/ARPGSaveGameSubsystem.cpp', 67, true),
      frame(3, 'UnrealEditor-Engine', 'UGameplayStatics::LoadGameFromSlot', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-18.15.28',
    mappedModule: null,
    rawLog: `[2026.02.14-18.15.28:234][  0]LogSerialization: Fatal: FArchive::Serialize: Attempt to serialize data with a corrupt archive
[2026.02.14-18.15.28:234][  0]LogWindows: Error: [Callstack]
[2026.02.14-18.15.28:234][  0]LogWindows: Error: UnrealEditor-MyGame!UARPGSaveGame::DeserializeInventory() [ARPGSaveGame.cpp:203]`,
    analyzed: false,
  },

  /* ── 6. Ensure failed — AI behavior tree ─────────────────────── */
  {
    id: 'crash-006',
    timestamp: '2026-02-14T17:50:55Z',
    crashType: 'ensure_failed',
    severity: 'low',
    errorMessage: 'Ensure condition failed: BlackboardComp != nullptr [UBTTask_ARPGAttackTarget::ExecuteTask]',
    callstack: [
      frame(0, 'UnrealEditor-Core', 'FDebug::OptionallyLogFormattedEnsureMessageReturningFalse', null, null, false),
      frame(1, 'UnrealEditor-MyGame', 'UBTTask_ARPGAttackTarget::ExecuteTask', 'Source/AI/BTTask_ARPGAttackTarget.cpp', 34, true, true),
      frame(2, 'UnrealEditor-AIModule', 'UBTTaskNode::WrappedExecuteTask', null, null, false),
      frame(3, 'UnrealEditor-AIModule', 'UBehaviorTreeComponent::ExecuteTask', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-17.50.55',
    mappedModule: null,
    rawLog: `[2026.02.14-17.50.55:789][  0]LogOutputDevice: Error: Ensure condition failed: BlackboardComp != nullptr
[2026.02.14-17.50.55:789][  0]LogOutputDevice: Error: [File:BTTask_ARPGAttackTarget.cpp] [Line: 34]`,
    analyzed: false,
  },

  /* ── 7. Stack overflow in recursive path ─────────────────────── */
  {
    id: 'crash-007',
    timestamp: '2026-02-13T23:20:11Z',
    crashType: 'stack_overflow',
    severity: 'critical',
    errorMessage: 'Unhandled Exception: EXCEPTION_STACK_OVERFLOW',
    callstack: [
      frame(0, 'UnrealEditor-MyGame', 'UARPGQuestManager::EvaluateQuestConditions', 'Source/Quests/ARPGQuestManager.cpp', 145, true, true),
      frame(1, 'UnrealEditor-MyGame', 'UARPGQuestManager::CheckDependencyChain', 'Source/Quests/ARPGQuestManager.cpp', 122, true),
      frame(2, 'UnrealEditor-MyGame', 'UARPGQuestManager::EvaluateQuestConditions', 'Source/Quests/ARPGQuestManager.cpp', 145, true),
      frame(3, 'UnrealEditor-MyGame', 'UARPGQuestManager::CheckDependencyChain', 'Source/Quests/ARPGQuestManager.cpp', 122, true),
      frame(4, 'UnrealEditor-MyGame', 'UARPGQuestManager::EvaluateQuestConditions', 'Source/Quests/ARPGQuestManager.cpp', 145, true),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.13-23.20.11',
    mappedModule: null,
    rawLog: `[2026.02.13-23.20.11:999][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_STACK_OVERFLOW
[2026.02.13-23.20.11:999][  0]LogWindows: Error: [Callstack] (truncated due to stack overflow)
[2026.02.13-23.20.11:999][  0]LogWindows: Error: UnrealEditor-MyGame!UARPGQuestManager::EvaluateQuestConditions() [ARPGQuestManager.cpp:145]`,
    analyzed: false,
  },

  /* ── 8. Duplicate null ASC crash (pattern match with #1) ─────── */
  {
    id: 'crash-008',
    timestamp: '2026-02-14T23:01:09Z',
    crashType: 'nullptr_deref',
    severity: 'critical',
    errorMessage: 'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
    callstack: [
      frame(0, 'UnrealEditor-Engine', 'FDebug::AssertFailed', null, null, false),
      frame(1, 'UnrealEditor-Engine', 'UAbilitySystemComponent::TryActivateAbility', null, null, false),
      frame(2, 'UnrealEditor-MyGame', 'AARPGCharacterBase::ActivateAbility', 'Source/Character/ARPGCharacterBase.cpp', 234, true, true),
      frame(3, 'UnrealEditor-MyGame', 'AARPGCharacterBase::HandleInputAction_Ability2', 'Source/Character/ARPGCharacterBase.cpp', 195, true),
      frame(4, 'UnrealEditor-Engine', 'UEnhancedInputComponent::ProcessInputAction', null, null, false),
    ],
    culpritFrame: null,
    machineState: DEFAULT_MACHINE,
    crashDir: 'Saved/Crashes/CrashReport-2026.02.14-23.01.09',
    mappedModule: null,
    rawLog: `[2026.02.14-23.01.09:111][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000
[2026.02.14-23.01.09:111][  0]LogWindows: Error: [Callstack]
[2026.02.14-23.01.09:111][  0]LogWindows: Error: UnrealEditor-MyGame!AARPGCharacterBase::ActivateAbility() [ARPGCharacterBase.cpp:234]`,
    analyzed: false,
  },
];

/* ---- Sample diagnoses -------------------------------------------- */

export const SAMPLE_DIAGNOSES: CrashDiagnosis[] = [
  {
    crashId: 'crash-001',
    summary: 'Null AbilitySystemComponent accessed during ability activation',
    rootCause: 'AARPGCharacterBase::ActivateAbility() calls GetAbilitySystemComponent()->TryActivateAbility() without null-checking the ASC pointer. The ASC is initialized in BeginPlay via InitAbilityActorInfo, but if the ability input fires before BeginPlay completes (e.g., during a level transition or respawn), the ASC is nullptr. This is a classic GAS initialization race condition.',
    uePattern: 'GAS Initialization Race — accessing UAbilitySystemComponent before InitAbilityActorInfo',
    confidence: 0.95,
    fixDescription: 'Add a null check on the ASC pointer before calling TryActivateAbility. Also consider deferring ability input binding until after ASC initialization is confirmed.',
    fixPrompt: `In Source/Character/ARPGCharacterBase.cpp at line 234, the ActivateAbility function accesses GetAbilitySystemComponent() without a null check. Fix this by:

1. Adding \`if (!GetAbilitySystemComponent()) return;\` guard at the top of ActivateAbility()
2. In BeginPlay, ensure InitAbilityActorInfo is called BEFORE binding input actions
3. Add a bAbilitiesInitialized flag that gates ability activation

Verify the build compiles after the fix.`,
    relatedChecklist: ['ac-1', 'ac-3'],
    tags: ['gas', 'nullptr', 'asc', 'initialization', 'race-condition'],
  },
  {
    crashId: 'crash-002',
    summary: 'Ability activation attempted during death flow',
    rootCause: 'UARPGAbilitySystemComponent::OnDeathStarted() attempts to activate a "death" ability via TryActivateAbility, but by this point the AbilitySpec for the death ability has already been cleared because CancelAllAbilities() was called earlier in the death flow. The assertion fires because the spec lookup returns nullptr.',
    uePattern: 'GAS Death Flow — abilities cleared before death ability activation',
    confidence: 0.88,
    fixDescription: 'Reorder the death flow: activate the death ability BEFORE calling CancelAllAbilities, or grant the death ability dynamically in OnDeathStarted before activating it.',
    fixPrompt: `In Source/GAS/ARPGAbilitySystemComponent.cpp at line 87, OnDeathStarted tries to activate a death ability after abilities have been canceled. Fix by:

1. Move the death ability activation to happen BEFORE CancelAllAbilities()
2. Alternatively, use GiveAbilityAndActivateOnce() to grant + activate atomically
3. Add a bIsDying flag to prevent re-entrant death flows

Verify the build compiles after the fix.`,
    relatedChecklist: ['ac-5'],
    tags: ['gas', 'death-flow', 'assertion', 'ability-spec'],
  },
  {
    crashId: 'crash-003',
    summary: 'Null loot table data asset on enemy death',
    rootCause: 'UARPGLootManager::RollLootTable() dereferences the LootTableDataAsset pointer at offset 0x48 without checking if it was set. The enemy archetype\'s LootTable property was left as nullptr in the data asset, meaning when this particular enemy type dies and calls DropLoot(), the LootManager crashes on the null data asset.',
    uePattern: 'Missing null check on DataAsset reference — common in data-driven loot systems',
    confidence: 0.92,
    fixDescription: 'Add null check on the loot table data asset before accessing it. Also add a warning log when an enemy has no loot table configured.',
    fixPrompt: `In Source/Loot/ARPGLootManager.cpp at line 156, RollLootTable dereferences a null LootTableDataAsset. Fix by:

1. Add \`if (!LootTableDataAsset) { UE_LOG(LogLoot, Warning, TEXT("No loot table for %s"), *GetNameSafe(SourceActor)); return TArray<FLootDrop>(); }\`
2. In ARPGEnemyCharacter::DropLoot, check if RollLootTable returns empty before spawning pickups
3. Consider adding a default/fallback loot table

Verify the build compiles after the fix.`,
    relatedChecklist: ['al-2', 'al-3'],
    tags: ['nullptr', 'loot', 'data-asset', 'missing-null-check'],
  },
  {
    crashId: 'crash-004',
    summary: 'Garbage collected item reference in inventory UI',
    rootCause: 'UARPGInventoryComponent stores raw UObject* pointers to UARPGItemInstance objects. When items are removed from inventory, the pointer is set to nullptr in the array but the UI widget caches a stale reference from the previous frame. On the next tick, the UI calls GetItemAtSlot() which returns the now-GC\'d object. The UObject has been garbage collected between frames.',
    uePattern: 'Stale UObject pointer — missing UPROPERTY marking or TWeakObjectPtr',
    confidence: 0.85,
    fixDescription: 'Use TWeakObjectPtr<UARPGItemInstance> instead of raw pointers in the inventory component, and check IsValid() before accessing. Alternatively, use UPROPERTY() to prevent GC.',
    fixPrompt: `In Source/Inventory/ARPGInventoryComponent.cpp at line 89, a garbage-collected UObject is accessed. Fix by:

1. Change item storage from \`UARPGItemInstance*\` to \`TWeakObjectPtr<UARPGItemInstance>\`
2. In GetItemAtSlot, check \`WeakPtr.IsValid()\` before returning
3. In the UI widget, re-query inventory data each frame instead of caching pointers
4. Ensure all item instance pointers are marked UPROPERTY()

Verify the build compiles after the fix.`,
    relatedChecklist: ['ai-1', 'ai-2'],
    tags: ['gc', 'uobject', 'inventory', 'weak-pointer', 'stale-reference'],
  },
  {
    crashId: 'crash-005',
    summary: 'Corrupt save file during inventory deserialization',
    rootCause: 'UARPGSaveGame::DeserializeInventory() reads inventory data from a save file that was written with an older version of the inventory struct. The struct changed (new fields added) but no version check was implemented, causing the archive to read past the end of valid data.',
    uePattern: 'Save/Load version mismatch — missing FArchive versioning',
    confidence: 0.82,
    fixDescription: 'Implement save file versioning using CustomVersions. Check the version before deserializing and handle migration from older formats.',
    fixPrompt: `In Source/SaveLoad/ARPGSaveGame.cpp at line 203, DeserializeInventory reads a corrupt archive. Fix by:

1. Define a custom version enum: \`enum class EARPGSaveVersion { Initial, InventoryRefactor, Latest }\`
2. Register with FCustomVersionRegistration
3. In Serialize(), check \`Ar.CustomVer(FARPGSaveVersion::GUID)\` before reading new fields
4. Provide fallback defaults for fields that don't exist in older saves

Verify the build compiles after the fix.`,
    relatedChecklist: ['asl-1', 'asl-2'],
    tags: ['serialization', 'save-load', 'versioning', 'corrupt-archive'],
  },
  {
    crashId: 'crash-006',
    summary: 'Missing Blackboard component in AI behavior tree task',
    rootCause: 'UBTTask_ARPGAttackTarget::ExecuteTask() accesses the Blackboard component without checking if it exists. The AI controller was spawned without a Blackboard asset configured, so GetBlackboardComponent() returns nullptr.',
    uePattern: 'Missing Blackboard validation in BT Task — common AI setup error',
    confidence: 0.9,
    fixDescription: 'Add null check for BlackboardComp at the start of ExecuteTask. Also validate that the AI controller has a Blackboard asset in BeginPlay.',
    fixPrompt: `In Source/AI/BTTask_ARPGAttackTarget.cpp at line 34, ExecuteTask accesses a null BlackboardComp. Fix by:

1. Add at top of ExecuteTask: \`UBlackboardComponent* BB = OwnerComp.GetBlackboardComponent(); if (!BB) return EBTNodeResult::Failed;\`
2. In the AI controller's BeginPlay, validate Blackboard asset is set
3. Add error logging when Blackboard is missing

Verify the build compiles after the fix.`,
    relatedChecklist: ['aai-1'],
    tags: ['ai', 'behavior-tree', 'blackboard', 'nullptr'],
  },
  {
    crashId: 'crash-007',
    summary: 'Infinite recursion in quest dependency evaluation',
    rootCause: 'UARPGQuestManager::EvaluateQuestConditions() and CheckDependencyChain() form a mutually recursive call pattern. Quest A depends on Quest B, and Quest B depends on Quest A, creating a circular dependency that recurses until stack overflow.',
    uePattern: 'Circular dependency in quest/dialogue graph — missing cycle detection',
    confidence: 0.97,
    fixDescription: 'Add cycle detection using a visited set. Before evaluating a quest\'s conditions, check if it\'s already in the evaluation stack.',
    fixPrompt: `In Source/Quests/ARPGQuestManager.cpp at line 145, EvaluateQuestConditions recurses infinitely due to circular quest dependencies. Fix by:

1. Add a TSet<FName> VisitedQuests parameter to EvaluateQuestConditions
2. At function entry, check \`if (VisitedQuests.Contains(QuestId)) return false;\`
3. Add QuestId to VisitedQuests before recursing
4. Add a validation pass at editor time that detects circular dependencies

Verify the build compiles after the fix.`,
    relatedChecklist: ['adq-2'],
    tags: ['recursion', 'stack-overflow', 'quest', 'circular-dependency'],
  },
  {
    crashId: 'crash-008',
    summary: 'Null AbilitySystemComponent accessed during ability activation (recurring)',
    rootCause: 'Same root cause as crash-001: AARPGCharacterBase::ActivateAbility() lacks a null check on the ASC. This is the second occurrence, triggered by a different ability input (Ability2 vs Ability1). This is a systemic issue — all ability input handlers share the same vulnerable code path.',
    uePattern: 'GAS Initialization Race — accessing UAbilitySystemComponent before InitAbilityActorInfo',
    confidence: 0.98,
    fixDescription: 'Same fix as crash-001. This recurring pattern confirms it is a systemic issue affecting all ability inputs.',
    fixPrompt: `RECURRING ISSUE (2nd occurrence). In Source/Character/ARPGCharacterBase.cpp at line 234, ActivateAbility still lacks ASC null check. This is now SYSTEMIC — affects all ability inputs (1, 2, etc.). Fix ALL ability activation paths:

1. Create a helper: \`bool CanActivateAbilities() const { return GetAbilitySystemComponent() && bAbilitiesInitialized; }\`
2. Guard ALL HandleInputAction_AbilityN functions with CanActivateAbilities()
3. Ensure InitAbilityActorInfo completes before input bindings

Verify the build compiles after the fix.`,
    relatedChecklist: ['ac-1', 'ac-3'],
    tags: ['gas', 'nullptr', 'asc', 'initialization', 'race-condition', 'recurring'],
  },
];
