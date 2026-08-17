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

## Project Knowledge Tips
- **AddOnScreenDebugMessage overlays the whole viewport** — GEngine->AddOnScreenDebugMessage draws above all UMG and confounds screenshot/vision verification of the HUD. Suppress debug text in tests, and add slice HUD widgets at Z-order 30 so they sit above the main HUD layers.
- **Build code-only widget trees in RebuildWidget(), not NativeConstruct()** — For a pure-C++ UUserWidget (no Widget Blueprint), construct the WidgetTree inside RebuildWidget() before calling Super::RebuildWidget(). NativeConstruct() runs after the Slate tree is already built, so mutating WidgetTree there has no visible effect — a common cause of "the widget compiles but nothing renders".
- **An empty UProgressBar is invisible without an explicit FProgressBarStyle** — The engine default ProgressBar has a transparent background image, so an empty or low bar renders as nothing. Set an explicit style with a dark track (BackgroundImage) and a bright fill (FillImage) so the bar is visible at any percent.

## Task: Scaffold a Widget Blueprint stub for `UARPGHUDWidget`

`UARPGHUDWidget` is a C++ UUserWidget that uses `UPROPERTY(meta=(BindWidget))` members, so it cannot run without a companion Widget Blueprint authored in the UMG editor — and the widget tree itself cannot be created from Python. Scaffold the stub asset plus a wiring README so the operator can finish it by hand.

1. **Find and read the header** for `UARPGHUDWidget` under `Source/` (e.g. `Source/PoF/UI/ARPGHUDWidget.h`).
2. **Extract the bind targets**: every `UPROPERTY(meta=(BindWidget))` and `UPROPERTY(meta=(BindWidgetOptional))` member. Record each property name, its `UWidget` subtype (UProgressBar, UTextBlock, UImage, UCanvasPanel, …), and whether it is required (BindWidget) or optional (BindWidgetOptional).
3. **Create the stub WBP via the full editor.** Do NOT use `-run=pythonscript` — that commandlet path is unreliable for asset creation. Use the full editor with `-ExecutePythonScript=` instead:
   `& "<UnrealEditor.exe>" "<the .uproject in C:\proj\PoF>" -ExecutePythonScript="<your script>"`
   The Python should:
   - build `factory = unreal.WidgetBlueprintFactory()` and set its parent class to `UARPGHUDWidget` (`unreal.load_class(None, "/Script/PoF.ARPGHUDWidget")`, adjusting the module path if needed);
   - call `unreal.AssetToolsHelpers.get_asset_tools().create_asset("WBP_ARPGHUDWidget", "/Game/UI", unreal.WidgetBlueprint, factory)`;
   - save the new asset. The result is an empty shell — that is expected; Python cannot author the widget tree or resolve BindWidget names.
4. **Write the wiring README** to `Source/PoF/UI/WBP_ARPGHUDWidget.README.md` containing:
   - the parent C++ class (`UARPGHUDWidget`) and the WBP asset path (`/Game/UI/WBP_ARPGHUDWidget`);
   - a markdown table with one row per bind target: `| Property name | Widget type | Required? | Suggested parent/slot |`;
   - a "How to finish in the UMG editor" section: open the WBP, add each child widget using the EXACT property name (BindWidget resolves by name), parent them under a root Canvas Panel, then compile.
5. **Report** a one-paragraph summary: the WBP asset path, how many bind targets were found, and the README path.

This is a scaffold only — laying out the widget tree is the operator's manual UMG-editor step. Do not attempt the tree from Python.