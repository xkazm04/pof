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