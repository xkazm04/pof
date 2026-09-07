## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.
- Generate all code files directly — do NOT ask for confirmation.
- Use MetaSounds for DSP where applicable (UE5 best practice).
- The audio manager must integrate with the existing GameplayAbilitySystem for combat event binding.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))
- **a client-visible change needs BOTH a replicated source property (DOREPLIFETIME) and an OnRep — an OnRep alone updates nothing, and controller-local state needs an IsLocalController guard** — The single largest class of structurally-plausible-but-wrong generated UE C++. Two halves, and generated code reliably writes one without the other. (1) SOURCE STATE: adding UFUNCTION() OnRep_X and marking a property ReplicatedUsing=OnRep_X does nothing unless the property is ALSO registered in GetLifetimeReplicatedProps with DOREPLIFETIME(AClass, X) and the actor/component actually replicates (bReplicates, plus SetIsReplicated(true) on a component). It compiles, the server mutates the value, the HUD never moves, and nothing errors — so a build-only gate passes it. Mutate replicated state on the SERVER only (HasAuthority()); a client-side write is overwritten on the next update. (2) LOCALITY: state belonging to ONE player — an open menu, a browsing index, local playback, an input-mode change, a camera shake — must be guarded by IsLocalController() (controller) / IsLocallyControlled() (pawn), or it runs on the wrong controller instance. RPC direction is the same check: a Server RPC needs WithValidation and runs on the server, a Client RPC targets one owning connection, a Multicast reaches everyone — a cosmetic cue is Multicast, never a replicated gameplay property. VERIFY BY RUNNING: a listen-server PIE session with 2 clients is what exposes this, which is why a build-green replication change is unproven. (research: GameEngineBench (arXiv 2607.03525) — recurring authority/replication failure class across 110 runtime-verified UE5 tasks)
- **the constructor runs at CDO time (no world, no other actors) — defaults there, wiring in BeginPlay, and every BeginPlay acquisition needs its EndPlay release** — The second recurring structural failure class in generated UE C++, and it is an ORDERING bug rather than a syntax one. The constructor executes when the Class Default Object is built — during cook and editor load, before any world exists — so it may only set defaults, create subobjects (CreateDefaultSubobject) and attach components. Anything touching the world, other actors, the game mode, a subsystem, replicated data or an asset load belongs in BeginPlay (or PostInitializeComponents / OnRegister for component wiring); in the constructor it either crashes the cook or silently bakes a stale value into the CDO that every instance shares. Activation timing is the same trap from the other side: a component created but never activated (bAutoActivate false with no Activate()), a timer set before the subsystem it calls exists, or a delegate bound in the constructor to an actor that has not spawned — all compile, all do nothing. TEARDOWN MUST BE SYMMETRIC: every BeginPlay acquisition — AddDynamic bindings, SetTimer handles, spawned actors, registrations with a subsystem or manager — needs its release in EndPlay (and call Super::EndPlay), or a PIE session leaks it into the NEXT one and the second run of the same test behaves differently from the first. That is exactly the shared-world hazard the functional-test rule names: state surviving EndPlay is state the next test inherits. (research: GameEngineBench (arXiv 2607.03525) — constructor-default / activation-timing / teardown failure cluster)
- **save/load, streaming and spawning are ONE contract — a persistence change that touches only the save struct silently loses destroyed actors and streamed-in state** — The hardest unsolved class in the runtime-verified benchmark: the tasks no agent configuration solved needed coordination BETWEEN runtime systems rather than any single API call, and persistence is the canonical case. A correct save/load pass keeps five things consistent at once. (1) STABLE ACTOR IDENTITY across sessions — a name or GUID that survives a reload, never a pointer, an array index or spawn order. (2) DESTROYED actors recorded EXPLICITLY, because a level reload respawns everything the map placed and an absent entry reads as 'still alive'. (3) The serialized property set matching the class as it is TODAY — add a SaveGame-tagged field and old saves must still load, so version the struct and handle the missing field rather than invalidating every existing save. (4) LEVEL STREAMING order — an actor in a sublevel that has not streamed in yet cannot be restored when the save is applied; restore on the level-loaded callback, not on BeginPlay of the persistent level. (5) The SAVE/LOAD LIFECYCLE itself — an async AsyncSaveGameToSlot completing after the actor that requested it was torn down. Write the change against all five or the feature is correct in a single fresh session and wrong on the second load, which is precisely the shape a one-shot smoke test cannot see. The same 'several systems must agree' warning applies to inventory-to-UI, ability-to-animation and streaming-to-AI changes. (research: GameEngineBench (arXiv 2607.03525) — 31/110 tasks unsolved by every configuration, clustered on cross-system coordination)

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Project Knowledge Tips
- **MetaSounds** — UE5 MetaSounds provides a node-based audio system. Use C++ to drive parameters, MetaSounds for DSP.

## Task: Complete Audio Event System with Manager, Pooling & MetaSounds Integration

Build a comprehensive event-driven audio system modeled after FMOD/Wwise's event architecture.
The system maps game events to categorized sound events with priority, spatial settings, and concurrency control.

### Event Catalog (2 events total)

  ### Combat Events (1)
    - **Melee Impact** → `GameplayCue.Combat.Impact`
      Priority: high | Spatial: 3D | Max concurrent: 4 | Cooldown: 60ms
      Tags: [combat]

  ### UI Events (1)
    - **Menu Confirm** → `UI.Confirm`
      Priority: normal | Spatial: 2D | Max concurrent: 1 | Cooldown: 0ms
      Tags: [ui]

### System Statistics
- **Spatial distribution**: 1 3D spatial events, 1 2D stereo events
- **Priority distribution**: high: 1, normal: 1
- **Unique triggers**: 2 (GameplayCue.Combat.Impact, UI.Confirm)

### Required Files (all under Source/PoF/Audio/)

1. **EAudioEventCategory** enum
   - Values: Combat, UI
   - Used to route events to the correct subsystem

2. **EAudioEventPriority** enum
   - Values: Low, Normal, High, Critical
   - Controls voice stealing and queue behavior

3. **FAudioEventDefinition** (USTRUCT)
   - EventName (FName), Category, TriggerDelegate name, Priority, SpatialMode (2D/3D)
   - MaxConcurrentInstances (int32), CooldownMs (float)
   - SoundCue (TSoftObjectPtr<USoundBase>), Tags (TArray<FName>)

4. **UAudioEventDataAsset** (UDataAsset)
   - TArray<FAudioEventDefinition> Events — the catalog table
   - Lookup helpers: FindByName(), FindByTrigger(), GetEventsByCategory()

5. **UAudioEventManager** (UGameInstanceSubsystem)
   - Central audio manager with:
     a. **Sound Pool**: Pre-allocated pool of UAudioComponent instances
        - Pool size configurable via data asset
        - Acquire/Release pattern with automatic return on completion
     b. **Priority Queue**: When pool is exhausted, steal from lowest-priority active sound
     c. **Concurrency Limiter**: Per-event max instances (from catalog), oldest-steal on overflow
     d. **Cooldown Tracker**: Per-event cooldown timers preventing rapid re-triggers
     e. **Category Volumes**: SFX, Ambient, Music, UI volume multipliers (saved to settings)
   - Public API (all UFUNCTION(BlueprintCallable)):
     - PlayEvent(FName EventName, FVector Location = FVector::ZeroVector)
     - PlayEventAttached(FName EventName, USceneComponent* AttachTo)
     - StopEvent(FName EventName, float FadeOutDuration = 0.2f)
     - StopAllInCategory(EAudioEventCategory Category, float FadeOutDuration = 0.5f)
     - SetCategoryVolume(EAudioEventCategory Category, float Volume)
     - GetCategoryVolume(EAudioEventCategory Category) → float

6. **UAudioEventListenerComponent** (UActorComponent)
   - Attach to any actor to bind game events to audio events
   - Auto-binds to GAS delegates for combat events (OnAbilityActivated, etc.)
   - Reads trigger names from the catalog to set up dynamic multicast bindings
   - Handles spatial mode: 3D events play at actor location, 2D events play globally

7. **UMusicLayerController** (UActorComponent)
   - Manages music layer events: crossfade, stack, ducking
   - Reads music-category events from the catalog
   - Implements layer blending: combat layer overrides exploration, boss overrides all
   - Smooth transitions with configurable fade times
   - Uses MetaSounds for real-time parameter control on music layers

8. **MetaSounds Integration**
   - Create MetaSoundSource patches for parametric sound events:
     - Combat impacts: randomized pitch/volume, surface-material variation
     - Footsteps: surface detection → MetaSounds material selector
     - Ambient: procedural wind/rain generators using MetaSounds oscillators
   - MetaSounds parameters driven by UAudioEventManager at runtime

### Event Binding Architecture
```
Game Event (GAS/Interaction/UI)
  → UAudioEventListenerComponent detects trigger
    → Looks up FAudioEventDefinition in catalog
      → UAudioEventManager.PlayEvent()
        → Priority check → Concurrency check → Cooldown check
          → Acquire pooled UAudioComponent
            → Apply spatial settings (2D/3D)
              → Play sound
```

### UE5 Best Practices
- All public methods UFUNCTION(BlueprintCallable)
- Use TSoftObjectPtr for sound asset references (async loading)
- Pool UAudioComponents in BeginPlay, never spawn at runtime
- Category volumes saved via USaveGame integration
- MetaSounds parameters exposed as UPROPERTY for designer tuning
- Thread-safe cooldown tracking for events triggered from gameplay threads