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