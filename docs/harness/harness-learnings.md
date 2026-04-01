# Harness Learnings

Patterns and gotchas discovered during autonomous game development.

- [2026-03-31] UCharacterMovementComponent::PerchRadiusThreshold controls how close to ledge edges the character can stand
- [2026-03-31] bMaintainHorizontalGroundVelocity is key for consistent speed on ramps/slopes

- [2026-03-31] APlayerController::InputKey(FInputKeyParams) is final in UE 5.7 — override InputKey(const FInputKeyEventArgs&) instead, include InputKeyEventArgs.h. Use Params.IsGamepad() for device detection.

- [2026-03-31] UHT cannot parse TArray<AActor*>() as a default parameter — use AutoCreateRefTerm meta specifier and move the param before defaulted params
- [2026-03-31] UPhysicalMaterial already has a SurfaceType member — custom subclasses must use a different name (e.g. GameSurfaceType)
- [2026-03-31] FVector_NetQuantize (from HitResult.ImpactPoint) cannot be used in ternary with FVector — explicit FVector() cast needed
- [2026-03-31] ChaosSolverEngine, GeometryCollectionEngine, FieldSystemEngine modules needed for Chaos destruction in UE 5.7

- [2026-03-31] Virtual IsDead() on base character class enables AnimInstance death state without coupling to specific subclass bIsAlive flags

- [2026-03-31] UE MotionWarping warp targets must be set BEFORE montage playback starts — the MotionWarping notify state reads them during the montage window
- [2026-03-31] Frame-to-frame weapon sweep tracing (previous vs current socket positions) catches fast-swing hits that single-frame traces miss
- [2026-03-31] Re-acquiring warp target on each combo section advance keeps magnetism tracking moving targets during multi-hit combos

- [2026-03-31] FGameplayEffectSpec::AddDynamicAssetTag() is the proper way to attach damage type metadata to a GE spec — the damage execution and PostGameplayEffectExecute can both read it via GetDynamicAssetTags()
- [2026-03-31] UAbilitySystemComponent::ExecuteGameplayCue() fires a one-shot cue without needing a GE — useful for hit impact feedback from PostGameplayEffectExecute
- [2026-03-31] Elemental resistances should be capped below 1.0 (0.9 cap) in PreAttributeChange to prevent full immunity

- [2026-03-31] UStaticMesh::NaniteSettings is deprecated in 5.7 — use IsNaniteEnabled() and GetNaniteSettings() accessor functions instead

- [2026-03-31] UAudioComponent::bEnableDefaultMultichannelEvaluation does not exist in UE 5.7 — removed without replacement
- [2026-03-31] EMaxConcurrentResolutionRule is a namespace enum in UE 5.7, not an enum class — must use TEnumAsByte<EMaxConcurrentResolutionRule::Type> for UPROPERTY
- [2026-03-31] UAudioComponent::SetBoolParameter() exists natively in UE 5.7 — no need for int workaround

- [2026-03-31] CanMove() should always check IsDead() as first gate to prevent dead characters from processing movement input — especially important for enemy AI that may call AddMovementInput after death

- [2026-03-31] UAnimNotify::NotifyColor set in constructor won't update when properties change in editor — override GetEditorColor() instead for dynamic color based on property values
- [2026-03-31] AnimNotifyState is more designer-friendly than two bookend instant notifies for window-based concepts (combo window, invulnerability frames) — the duration bar is intuitive
- [2026-03-31] Montage_GetCurrentSection() returns the active section name — useful for section-aware AnimBP transitions and per-section logic

- [2026-03-31] GE_Heal should modify IncomingHeal meta attribute (not Health directly) to go through the full heal pipeline with GameplayCue support in PostGameplayEffectExecute

- [2026-03-31] Enemy abilities should use distinct Ability.Enemy.* tags rather than reusing player ability tags (e.g. Ability.Melee.LightAttack) to prevent tag-based filtering collisions between player and enemy ability sets
- [2026-03-31] GA_HitReact should block on State.Attacking/Invulnerable/Dashing to avoid interrupting active player actions — hit react is a lower priority response
- [2026-03-31] GA_UsePotion is fire-and-forget (CommitAbility + ApplyEffectToSelf + EndAbility) — no montage needed, cooldown gates usage

- [2026-03-31] UAudioComponent created via NewObject on a subsystem (no world) won't produce sound — must RegisterComponentWithWorld after a world exists, or create lazily
- [2026-03-31] FAudioDeviceHandle from World->GetAudioDevice() provides ActivateReverbEffect/DeactivateReverbEffect for runtime reverb control without AReverbVolume actors
- [2026-03-31] GConfig->SetFloat/GetFloat with GGameUserSettingsIni is the lightweight way to persist audio settings without a full SaveGame system

- [2026-03-31] UDragDropOperation already has a Payload member — do not re-declare it in subclasses or UHT will error on shadowing

- [2026-03-31] GA_HitReact must set/clear bIsHitReacting on the character so CanMove() properly gates movement during hit reactions — without this, the character can walk freely while playing a hit-react montage
- [2026-03-31] FGameplayAbilityTargetData::GetHitResult() can return nullptr even when TargetData.Num() > 0 — always null-check before dereferencing

- [2026-03-31] APlayerController::PlayDynamicForceFeedback() is the simplest way to trigger gamepad vibration — no ForceFeedbackEffect asset needed, just intensity + duration + channel booleans
- [2026-03-31] Test dummy respawn requires cancelling all GAS abilities first (to clear State.Dead from ActivationOwnedTags), then re-granting abilities and re-initializing attributes

- [2026-03-31] BT task nodes are shared singletons by default (bCreateNodeInstance=false) — per-instance state MUST use GetInstanceMemorySize()/NodeMemory, not member variables. Storing FDelegateHandle or float state as member vars corrupts when multiple enemies share the same BT.
- [2026-03-31] FPathFollowingRequestResult is forward-declared in AIController.h — include Navigation/PathFollowingComponent.h to use it (known UE 5.7 gotcha)
- [2026-03-31] WaitForMessage(OwnerComp, UBrainComponent::AIMessage_MoveFinished) is the cleanest way to wait for MoveTo completion in BT tasks without manual delegate plumbing

- [2026-03-31] BTService nodes are also shared singletons like BTTask nodes — NoLOSTimer as a member variable corrupts when multiple enemies share the same BT. Must use GetInstanceMemorySize()/NodeMemory.
- [2026-03-31] ASC->OnAbilityEnded fires for ALL abilities ending on that ASC, not just the one you activated — must filter by FGameplayAbilitySpecHandle to avoid premature BT task completion
- [2026-03-31] WaitForMessage(OwnerComp, UBrainComponent::AIMessage_MoveFinished) is safer than lambda-based OnRequestFinished delegates in BT tasks — avoids dangling reference captures on OwnerComp

- [2026-03-31] GameplayDebugger module in UE 5.7 is at Source/Runtime/GameplayDebugger, module name is 'GameplayDebugger'
- [2026-03-31] StateTree plugin modules: 'StateTreeModule' (runtime) and 'GameplayStateTreeModule' (AI integration)
- [2026-03-31] State Tree tasks/conditions/evaluators are USTRUCT-based (not UCLASS) with separate instance data structs
- [2026-03-31] FGameplayDebuggerCategory::SetDataPackReplication<T> requires T to have a Serialize(FArchive&) method
- [2026-03-31] UAISenseConfig_Hearing uses HearingRange (not SightRadius-style naming)

- [2026-04-01] UMaterialInterface::GetUsedTextures() with quality/featurelevel params is deprecated in 5.7 — use the parameterless overload
- [2026-04-01] TArray<T*>::Sort() with const T* lambda fails due to TDereferenceWrapper — use Algo::Sort() with Algo/Sort.h include

- [2026-04-01] UHT parameter shadowing: UFUNCTION params cannot share names with UPROPERTY members in the same UCLASS — use InRarity instead of Rarity to avoid 'shadowing is not allowed' UHT error

- [2026-04-01] FOnItemPickedUpStatic (static multicast delegate) allows HUD to bind once globally without per-actor references — useful for pickup notification feeds

- [2026-04-01] SetRenderTranslation offsets from the widget's layout anchor — for world-projected damage numbers use SetPositionInViewport with screen coordinates instead
- [2026-04-01] UMG widgets created in HUD::BeginPlay but never bound to data sources are inert — must call BindToInventory/BindToAbilitySystem from BindWidgetsToPlayer

- [2026-04-01] UUserWidget has no SetRootWidget() method — use WidgetTree->RootWidget = widget to set programmatic root
- [2026-04-01] UFUNCTION cannot return const USTRUCT* — use a copy-out pattern (bool GetFoo(FName ID, FStruct& Out) const) for Blueprint exposure
- [2026-04-01] UARPGInventoryComponent methods take UARPGItemDefinition* not FName — dialogue item actions need Blueprint wiring or asset manager lookup

- [2026-04-01] AActor has a 'Role' member — UPROPERTY named 'Role' in subclasses causes UHT shadowing error. Use 'NPCRole' instead.
- [2026-04-01] FSlateChildSize does not accept float in UE 5.7 — use ESlateSizeRule::Fill for proportional fill in HorizontalBox slots.

- [2026-04-01] Iterating a TMap while AddObjectiveProgress->CheckAutoComplete->CompleteQuest modifies it is undefined behavior — collect pending operations first then apply
- [2026-04-01] HasDialogueForPlayer must check entry conditions on dialogue trees, not just check if trees exist — expose EvaluateConditions as public CheckConditions

- [2026-04-01] GAS meta-attribute pattern (IncomingXP like IncomingDamage) is the clean way to bridge GE-based XP awards to local game logic — avoids dual-tracking between GAS attributes and local state
- [2026-04-01] ApplyModToAttribute with EGameplayModOp::Override does NOT trigger PostGameplayEffectExecute, only attribute change delegates — safe for syncing GAS back from local authoritative state without recursion

- [2026-04-01] UButton::OnClicked is a dynamic multicast delegate (no lambda support) — use a shared UFUNCTION + IsHovered() TMap lookup pattern for programmatically-created button arrays
- [2026-04-01] BindWidget meta on UUserWidget requires a Blueprint subclass to provide the slot — programmatic children are added into those containers, not replacing them

- [2026-04-01] UWidgetTree::ConstructWidget<T>() in UE 5.7 takes (TSubclassOf<T>, FName) — cannot pass TEXT() directly as first arg, must pass StaticClass() + FName
- [2026-04-01] UAbilitySystemComponent::GetGameplayAttributeValue() returns float and takes a bool& bFound output param — cannot assign to two separate float variables
- [2026-04-01] TObjectPtr<USphereComponent> implicit conversion to USceneComponent* fails without the full type definition — include the component header in the cpp

- [2026-04-01] FOnLevelLoaded does not exist in UE 5.7 — ULevelStreaming::OnLevelLoaded is FLevelStreamingLoadedStatus, not a standard delegate. Use timer-based completion instead.
- [2026-04-01] ULevelStreaming::OnLevelLoaded.AddLambda() does not compile in 5.7 — the delegate type changed

- [2026-04-01] SpawnSoundAttached with bAutoDestroy=false keeps the UAudioComponent alive for manual Stop()/Play() control on cycling hazards
- [2026-04-01] ULevelStreaming::IsLevelLoaded() && IsLevelVisible() is the reliable way to check streaming completion — fixed timers are unreliable
- [2026-04-01] SetIgnoreMoveInput/SetIgnoreLookInput on PlayerController is the clean way to freeze player during zone transitions without disabling the entire input stack

- [2026-04-01] UNavModifierComponent::SetAreaClass(nullptr) effectively disables the nav modifier without removing the component
- [2026-04-01] NavArea cost of 10.0 is sufficient to make AI strongly avoid hazards while still allowing pathfinding through them if no alternative exists

- [2026-04-01] Timer handles in UE actors MUST be cleared in EndPlay — destroying an actor with active timer delegates causes use-after-free crashes
- [2026-04-01] SetActorTickEnabled(false) + bStartWithTickEnabled=false is the proper pattern for actors that only need Tick during brief animation windows
- [2026-04-01] Overlap-triggered zone transitions need cooldown timers to prevent rapid re-trigger from player oscillating on trigger volume edges

- [2026-04-01] Timer handles in UE actors MUST be cleared in EndPlay — destroying an actor with active timer delegates causes use-after-free crashes
- [2026-04-01] GameInstanceSubsystem::Deinitialize must clear any world-based timer handles since the world may be torn down concurrently
- [2026-04-01] ZoneTransition non-overlap interact mode needs an explicit call path — adding Interactable tag and BlueprintCallable TryInteractTransition enables it

- [2026-04-01] DECLARE_DYNAMIC_MULTICAST_DELEGATE does not support AddLambda — must use AddDynamic with a UFUNCTION for dynamic delegates
- [2026-04-01] GetOverlappingActors() on BeginPlay catches actors already inside trigger volumes that won't generate overlap events

- [2026-04-01] AARPGCharacterBase::InitializeAttributes() is protected — cannot call from external actors like BossEncounter
- [2026-04-01] Dynamic delegate RemoveDynamic must be called in ALL exit paths (not just CompleteEncounter but also OnPlayerDied) to prevent double-binding on retrigger
- [2026-04-01] GetOverlappingActors() on BeginPlay is needed for hazards too — actors spawned inside a hazard volume won't generate overlap events

- [2026-04-01] AARPGEncounterVolume inherits from ASpawnVolume — adding UPROPERTY to parent that child already declares causes UHT shadowing error
- [2026-04-01] SpawnVolume's SpawnNextInWave is not virtual — max enemy cap must be enforced in the base class for subclasses to benefit

- [2026-04-01] OnlineSubsystem already declares FOnCreateSessionComplete, FOnFindSessionsComplete, FOnJoinSessionComplete, FOnDestroySessionComplete — custom dynamic delegates must use different names (e.g. FOnARPG* prefix) to avoid redefinition errors
- [2026-04-01] SEARCH_PRESENCE macro may not exist in UE 5.7 OnlineSubsystem — omit presence query settings for LAN sessions
- [2026-04-01] UAbilitySystemComponent is forward-declared in multiple headers — must include AbilitySystemComponent.h explicitly when calling methods like TryActivateAbilitiesByTag

- [2026-04-01] BeginReplication() is deprecated in UE 5.7 — override FillReplicationParams() for per-actor Iris config and OnReplicationStartedForIris() for post-start setup
- [2026-04-01] FActorReplicationParams::AlwaysRelevant bypasses spatial filtering for actors that must replicate to all connections (GameState, GameMode)
- [2026-04-01] FActorReplicationParams lives in Net/Iris/ReplicationSystem/EngineReplicationBridge.h
- [2026-04-01] UActorComponent has OnReplicationStartedForIris but not FillReplicationParams — filtering is actor-level only

- [2026-04-01] AActor::NetUpdateFrequency is deprecated in UE 5.7 — use SetNetUpdateFrequency()/GetNetUpdateFrequency() instead
- [2026-04-01] AActor::NetCullDistanceSquared is deprecated in UE 5.7 — use SetNetCullDistanceSquared()/GetNetCullDistanceSquared() instead
- [2026-04-01] UFUNCTION returning uint32 is not supported by Blueprint — use int32 for BP-exposed prediction sequence numbers

- [2026-04-01] GameInstanceSubsystem::Deinitialize must clear timer handles since the world may be torn down concurrently
- [2026-04-01] DECLARE_DYNAMIC_MULTICAST_DELEGATE does not support AddLambda — must use AddDynamic with a UFUNCTION for dynamic delegates
- [2026-04-01] Inventory restoration after load must be deferred to BeginPlay timing — the pawn may not exist yet when LoadFromSlot runs

- [2026-04-01] UHorizontalBox::AddChildToHorizontalBox returns UHorizontalBoxSlot* (not lvalue reference) — cannot bind to auto&
- [2026-04-01] Include Components/HorizontalBoxSlot.h for SetSize/SetHorizontalAlignment on HorizontalBox slots

- [2026-04-01] FColor::Orange and other FColor constants cannot be used as UHT default parameters — use FLinearColor for Blueprint-exposed color params
- [2026-04-01] GetPlayerViewPoint returns FRotator not FVector for the rotation output — use ViewRot.Vector() for direction

- [2026-04-01] Editor targets that share build environment with UnrealEditor cannot add GlobalDefinitions — UBT rejects property modifications on shared targets. Only Game/Server targets with unique build environments can use custom defines.
- [2026-04-01] GConfig->GetInt/GetString with GGameIni reads from DefaultGame.ini section paths matching the UCLASS path
