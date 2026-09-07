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
- Each screen must be a separate UUserWidget subclass with a corresponding C++ class.
- The navigation controller must manage all screen transitions via a central stack-based system.

## Known UE Pitfalls
- **a code-only UUserWidget builds its Slate tree in RebuildWidget(), not NativeConstruct()** — A C++-only UUserWidget with no UMG asset must construct its widget hierarchy by overriding RebuildWidget(); NativeConstruct() runs too late and the tree is empty. BindWidget members still require a WBP. (vertical-slice: HUD)
- **AddOnScreenDebugMessage debug text draws over UMG and pins to the top-left** — GEngine->AddOnScreenDebugMessage prints above all UMG and pins to the top-left corner, colliding with anything placed there and confounding screenshot/vision HUD checks. Either offset HUD elements down (the slice put the player health bar at y=90) or disable it in dev with the DisableAllScreenMessages console command. (vertical-slice: HUD)
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

## Known Project Assets (use these EXACT paths — do not invent paths)
- **/Script/PoF.ARPGCodeWidgetBase** (C++ Class (UARPGCodeWidgetBase), project) — Pure-C++ UMG widget parent (no BindWidget; build tree in RebuildWidget). All Screen Flow widgets extend this.

## Project Knowledge Tips
- **C++ driven UMG** — Create widgets in C++ and use Blueprint for layout. This gives you type safety and better performance.

## Task: Menu Navigation System with Screen Flow

Build a complete menu navigation system for UE5 UMG with a central navigation controller that manages all screen transitions.

### Screen Hierarchy

  - **Main Menu** (Main Menu) — owned by GameInstance
    Widgets:
    - Play
    - Settings
    - Quit

  - **Settings** (Settings Screen) — owned by GameInstance
    Widgets:
    - Audio
    - Video

### Navigation Transitions

  - Main Menu ⟷ Settings (trigger: "Settings clicked")

### Ownership Model

  - **GameInstance**: Main Menu, Settings

### Required Files (all under Source/PoF/UI/Menus/)

1. **UMenuNavigationController** (.h/.cpp)
   - Singleton-style subsystem (UGameInstanceSubsystem or component on PlayerController depending on scope)
   - Stack-based screen management: PushScreen(), PopScreen(), PopToRoot()
   - Manages all transitions defined above
   - UFUNCTION(BlueprintCallable) for all navigation methods
   - Fires delegates on screen changes (OnScreenPushed, OnScreenPopped)
   - Handles input mode switching (UI-only vs Game+UI vs Game-only)
   - Z-order management for overlapping screens

2. **Screen Widget Classes**
  - UMainMenuWidget (.h/.cpp) — Main Menu
  - USettingsWidget (.h/.cpp) — Settings Screen

   Each screen widget must:
   - Inherit from a shared UMenuScreenBase widget class
   - Have UPROPERTY(meta=(BindWidget)) references to child widgets
   - Call NavigationController->PushScreen()/PopScreen() for transitions
   - Implement Enter/Exit animations (fade, slide) via UWidgetAnimation
   - Handle its own input bindings (e.g., Escape to go back)

3. **UMenuScreenBase** (.h/.cpp)
   - Base class for all menu screen widgets
   - Virtual Enter()/Exit() methods with animation support
   - Back button handling (pops the screen stack)
   - Common styling setup in NativeConstruct

4. **EMenuScreenType** enum
   - One entry per screen: MainMenu, Settings
   - Used by NavigationController to identify and instantiate screens

### Transition Behavior
- Push transitions play an "enter" animation on the new screen and "exit" on the old
- Pop transitions reverse: "exit" on current, "re-enter" on the revealed screen
- Bidirectional transitions allow both push and pop navigation between those screens
- Loading screens should block input until loading completes
- Pause menu should pause game time (SetGamePaused)

### UE5 Best Practices
- All widgets created in C++ with UPROPERTY(meta=(BindWidget)) for UMG designer access
- Use TSubclassOf<UMenuScreenBase> for screen class references in the controller
- NativeConstruct / NativeDestruct for setup/teardown
- Input mode transitions: FInputModeUIOnly for menus, FInputModeGameAndUI for HUD overlays
- All public methods UFUNCTION(BlueprintCallable)
- Use soft references (TSoftClassPtr) for screen classes to avoid hard loading all menus at startup