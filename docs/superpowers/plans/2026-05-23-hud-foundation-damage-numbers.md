# HUD Foundation + Damage Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the vertical-slice HUD's hard-won lessons into a reusable, regression-proof base class; guarantee floating damage numbers in the slice; and encode the pure-C++ widget pattern into the PoF app's `arpg-ui` checklist.

**Architecture:** A new `UARPGCodeWidgetBase` (`UUserWidget` subclass) owns the `RebuildWidget`-before-`Super` build-timing pattern and the styled-bar/text helpers currently trapped in `VSHUDWidget.cpp`'s anonymous namespace. `UVSHUDWidget` reparents onto it. `AVSHUD` idempotently ensures a `UDamageNumberManagerComponent` on the player controller so numbers fire regardless of which controller `BP_VSGameMode` uses. One placed functional test (`AVSHUDFunctionalTest`) proves tree structure, GAS bar binding, and damage-number spawning headless. The PoF app's `arpg-ui` checklist + knowledge tips default future HUD generation to this pattern, guarded by a vitest.

**Tech Stack:** UE5.7 C++ (UMG, GAS, FunctionalTesting/AutomationTest, editor Python), Next.js/TypeScript + vitest (PoF app).

**Two repositories:**
- **UE project** — `C:\Users\kazda\Documents\Unreal Projects\PoF` (git remote `github.com/xkazm04/pof-exp`; **pushes work** — push at the end).
- **PoF app** — `C:\Users\kazda\kiro\pof` (**commit locally only — DO NOT push**). The working tree contains other parallel sessions' uncommitted changes; **stage only the files this plan names**, never `git add -A`.

**Shared commands (UE project).** Adjust the engine path to your UE 5.7 install:
- Build editor:
  ```powershell
  & "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex -NoHotReloadFromIDE
  ```
- Run a functional test (replace `<TestName>`):
  ```powershell
  & "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecCmds="Automation RunTests <TestName>;Quit" -unattended -nopause -nullrhi -log
  ```
  Pass criterion: the log contains `Test Completed. Result={Success}` and `...Result={Failure}` is absent.

**Commit convention (both repos):** end every commit message with
`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**UE project (`Source/PoF/`):**
- `UI/ARPGCodeWidgetBase.h` / `.cpp` — **create.** Reusable pure-C++ widget base.
- `UI/VSHUDWidget.h` / `.cpp` — **modify.** Reparent onto the base; drop the local `RebuildWidget` + anonymous-namespace helpers.
- `UI/DamageNumberWidget.cpp` — **modify.** Add a text shadow for legibility.
- `UI/VSHUD.cpp` — **modify.** Ensure a `DamageNumberManagerComponent` on the owning controller.
- `Test/HUD/AVSHUDFunctionalTest.h` / `.cpp` — **create.** Placed functional test (3 phases).
- `Content/Python/place_hud_test.py` — **create.** Places the test actor in the slice map.
- `Content/Maps/VerticalSlice.umap` (binary) — **modified** by the Python step (commit it).

**PoF app (`C:\Users\kazda\kiro\pof`):**
- `src/__tests__/lib/arpg-ui-prompt.test.ts` — **create.** Regression guard.
- `src/lib/module-registry.ts` — **modify.** `au-1`/`au-7` prompts + `arpg-ui` `knowledgeTips`.

---

## Task 1: Create `UARPGCodeWidgetBase`

**Files:**
- Create: `Source/PoF/UI/ARPGCodeWidgetBase.h`
- Create: `Source/PoF/UI/ARPGCodeWidgetBase.cpp`

- [ ] **Step 1: Write the header**

`Source/PoF/UI/ARPGCodeWidgetBase.h`:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Styling/SlateBrush.h"
#include "Styling/SlateTypes.h"
#include "ARPGCodeWidgetBase.generated.h"

class UProgressBar;
class UTextBlock;
class UCanvasPanel;
class UCanvasPanelSlot;
class UWidget;

/**
 * Base for pure-C++ UMG widgets (no companion Widget Blueprint, no BindWidget).
 *
 * Encodes two lessons that previously had to be re-learned per widget:
 *  1. Build the widget tree in RebuildWidget() (override BuildTree()) — it runs
 *     BEFORE Super::RebuildWidget() constructs the Slate tree. NativeConstruct()
 *     runs too late: mutating WidgetTree there has no visible effect.
 *  2. An empty UProgressBar is invisible with the engine default (transparent
 *     background image). MakeBarStyle() gives an explicit dark track + bright
 *     fill so a bar is visible at any percent.
 *
 * Note: AddOnScreenDebugMessage draws above all UMG. Add slice HUD widgets at
 * DefaultHUDZOrder, and suppress debug text in tests, so vision checks aren't
 * confounded.
 */
UCLASS(Abstract)
class POF_API UARPGCodeWidgetBase : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Z-order for slice HUD widgets: above the main ARPG HUD layers (0-15),
	 *  below on-screen debug text (which always draws on top). */
	static constexpr int32 DefaultHUDZOrder = 30;

protected:
	/** Build the widget tree here. Override this; do NOT override RebuildWidget(). */
	virtual void BuildTree() {}

	virtual TSharedRef<SWidget> RebuildWidget() override;

	// --- Styling helpers ---
	static FSlateBrush MakeSolidBrush(const FLinearColor& Colour);

	/** Dark track + bright fill — an empty UProgressBar is otherwise invisible. */
	static FProgressBarStyle MakeBarStyle(
		const FLinearColor& Fill,
		const FLinearColor& Track = FLinearColor(0.04f, 0.04f, 0.05f, 0.85f));

	/** Construct a styled UProgressBar into WidgetTree (percent initialised to 1). */
	UProgressBar* CreateStyledProgressBar(FName Name, const FLinearColor& Fill);

	/** Construct a UTextBlock into WidgetTree with the given font + colour. */
	UTextBlock* CreateStyledTextBlock(FName Name, const FSlateFontInfo& Font,
		const FLinearColor& Colour);

	/** Add Child to Canvas anchored top-left at Position with the given Size. */
	static UCanvasPanelSlot* AnchorTopLeft(UCanvasPanel* Canvas, UWidget* Child,
		FVector2D Position, FVector2D Size);

	/** Add Child to Canvas anchored+aligned top-centre. bAutoSize ignores Size. */
	static UCanvasPanelSlot* AnchorTopCentre(UCanvasPanel* Canvas, UWidget* Child,
		FVector2D Position, FVector2D Size, bool bAutoSize = false);
};
```

- [ ] **Step 2: Write the implementation**

`Source/PoF/UI/ARPGCodeWidgetBase.cpp`:

```cpp
#include "UI/ARPGCodeWidgetBase.h"
#include "Blueprint/WidgetTree.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/ProgressBar.h"
#include "Components/TextBlock.h"

TSharedRef<SWidget> UARPGCodeWidgetBase::RebuildWidget()
{
	if (!WidgetTree)
	{
		WidgetTree = NewObject<UWidgetTree>(this, TEXT("WidgetTree"));
	}
	BuildTree();
	return Super::RebuildWidget();
}

FSlateBrush UARPGCodeWidgetBase::MakeSolidBrush(const FLinearColor& Colour)
{
	FSlateBrush Brush;
	Brush.TintColor = FSlateColor(Colour);
	Brush.DrawAs = ESlateBrushDrawType::Box;
	Brush.ImageSize = FVector2D(16.f, 16.f);
	return Brush;
}

FProgressBarStyle UARPGCodeWidgetBase::MakeBarStyle(const FLinearColor& Fill, const FLinearColor& Track)
{
	FProgressBarStyle Style;
	Style.BackgroundImage = MakeSolidBrush(Track);
	Style.FillImage       = MakeSolidBrush(Fill);
	Style.MarqueeImage    = MakeSolidBrush(Fill);
	Style.EnableFillAnimation = false;
	return Style;
}

UProgressBar* UARPGCodeWidgetBase::CreateStyledProgressBar(FName Name, const FLinearColor& Fill)
{
	UProgressBar* Bar = WidgetTree->ConstructWidget<UProgressBar>(UProgressBar::StaticClass(), Name);
	Bar->SetWidgetStyle(MakeBarStyle(Fill));
	Bar->SetFillColorAndOpacity(Fill);
	Bar->SetPercent(1.f);
	return Bar;
}

UTextBlock* UARPGCodeWidgetBase::CreateStyledTextBlock(FName Name, const FSlateFontInfo& Font, const FLinearColor& Colour)
{
	UTextBlock* Text = WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass(), Name);
	Text->SetFont(Font);
	Text->SetColorAndOpacity(FSlateColor(Colour));
	return Text;
}

UCanvasPanelSlot* UARPGCodeWidgetBase::AnchorTopLeft(UCanvasPanel* Canvas, UWidget* Child, FVector2D Position, FVector2D Size)
{
	UCanvasPanelSlot* Slot = Cast<UCanvasPanelSlot>(Canvas->AddChildToCanvas(Child));
	if (Slot)
	{
		Slot->SetAnchors(FAnchors(0.f, 0.f));
		Slot->SetPosition(Position);
		Slot->SetSize(Size);
	}
	return Slot;
}

UCanvasPanelSlot* UARPGCodeWidgetBase::AnchorTopCentre(UCanvasPanel* Canvas, UWidget* Child, FVector2D Position, FVector2D Size, bool bAutoSize)
{
	UCanvasPanelSlot* Slot = Cast<UCanvasPanelSlot>(Canvas->AddChildToCanvas(Child));
	if (Slot)
	{
		Slot->SetAnchors(FAnchors(0.5f, 0.f));
		Slot->SetAlignment(FVector2D(0.5f, 0.f));
		Slot->SetPosition(Position);
		if (bAutoSize) { Slot->SetAutoSize(true); }
		else { Slot->SetSize(Size); }
	}
	return Slot;
}
```

- [ ] **Step 3: Build the editor**

Run the build command (top of plan).
Expected: `BUILD SUCCESSFUL`. The base class is unused so far — this just verifies it compiles + links.

- [ ] **Step 4: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/UI/ARPGCodeWidgetBase.h Source/PoF/UI/ARPGCodeWidgetBase.cpp
git commit -m @'
feat(ui): UARPGCodeWidgetBase — reusable pure-C++ UMG widget base

RebuildWidget-timing pattern + styled bar/text helpers, extracted so
code-only widgets cannot regress the invisible-bar / NativeConstruct bugs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 2: Reparent `UVSHUDWidget` onto the base

**Files:**
- Modify: `Source/PoF/UI/VSHUDWidget.h`
- Modify: `Source/PoF/UI/VSHUDWidget.cpp`

- [ ] **Step 1: Update the header**

In `Source/PoF/UI/VSHUDWidget.h`: change the include + base class, and turn `RebuildWidget` into a protected `BuildTree` override.

Replace:
```cpp
#include "Blueprint/UserWidget.h"
#include "VSHUDWidget.generated.h"
```
with:
```cpp
#include "UI/ARPGCodeWidgetBase.h"
#include "VSHUDWidget.generated.h"
```

Replace the class declaration line:
```cpp
class POF_API UVSHUDWidget : public UUserWidget
```
with:
```cpp
class POF_API UVSHUDWidget : public UARPGCodeWidgetBase
```

Replace the `protected:` block that declares `RebuildWidget`:
```cpp
protected:
	/** Build the widget tree here — runs before the Slate tree is constructed,
	 *  unlike NativeConstruct() which runs too late for WidgetTree mutation. */
	virtual TSharedRef<class SWidget> RebuildWidget() override;

private:
	void BuildTree();
```
with:
```cpp
protected:
	/** Build the slice HUD tree. Base class calls this from RebuildWidget(). */
	virtual void BuildTree() override;

private:
```

- [ ] **Step 2: Update the implementation**

In `Source/PoF/UI/VSHUDWidget.cpp`:

Delete the entire anonymous-namespace block (the `namespace { ... }` containing `MakeSolidBrush` and `MakeBarStyle`, lines ~13-37) — those now live on the base.

Delete the `RebuildWidget()` override (lines ~39-46):
```cpp
TSharedRef<SWidget> UVSHUDWidget::RebuildWidget()
{
	BuildTree();
	return Super::RebuildWidget();
}
```

Change the bar-construction lines inside `BuildTree()` to use the base helpers. Replace:
```cpp
	PlayerHealthBar = WidgetTree->ConstructWidget<UProgressBar>(UProgressBar::StaticClass(), FName(TEXT("PlayerHealthBar")));
	PlayerHealthBar->SetWidgetStyle(MakeBarStyle(PlayerFill));
	PlayerHealthBar->SetFillColorAndOpacity(PlayerFill);
	PlayerHealthBar->SetPercent(1.f);
	PlayerFrame->SetContent(PlayerHealthBar);
```
with:
```cpp
	PlayerHealthBar = CreateStyledProgressBar(FName(TEXT("PlayerHealthBar")), PlayerFill);
	PlayerFrame->SetContent(PlayerHealthBar);
```

Replace:
```cpp
	EnemyHealthBar = WidgetTree->ConstructWidget<UProgressBar>(UProgressBar::StaticClass(), FName(TEXT("EnemyHealthBar")));
	EnemyHealthBar->SetWidgetStyle(MakeBarStyle(EnemyFill));
	EnemyHealthBar->SetFillColorAndOpacity(EnemyFill);
	EnemyHealthBar->SetPercent(1.f);
	EnemyFrame->SetContent(EnemyHealthBar);
```
with:
```cpp
	EnemyHealthBar = CreateStyledProgressBar(FName(TEXT("EnemyHealthBar")), EnemyFill);
	EnemyFrame->SetContent(EnemyHealthBar);
```

The `FrameBrush` line still calls `MakeSolidBrush(...)` — it now resolves to the inherited static, so no change needed there. Leave the Border, text-block, and anchor/position code exactly as-is (FNames must stay `PlayerHealthBar`, `EnemyHealthBar`, `PlayerHealthText`, `EnemyHealthText`, `EnemyNameText` — Task 5 finds widgets by these names).

The now-unused `#include "Components/ProgressBar.h"` can stay (harmless). Keep `#include "UI/VSHUDWidget.h"` as the first include.

- [ ] **Step 3: Build the editor**

Run the build command.
Expected: `BUILD SUCCESSFUL`. (Compile error here usually means a leftover reference to the removed local `MakeBarStyle`/`RebuildWidget` — search the file for them.)

- [ ] **Step 4: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/UI/VSHUDWidget.h Source/PoF/UI/VSHUDWidget.cpp
git commit -m @'
refactor(ui): reparent UVSHUDWidget onto UARPGCodeWidgetBase

Drops the local RebuildWidget override + anonymous-namespace bar helpers
in favour of the shared base. HUD layout/visuals unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 3: Damage-number text legibility

**Files:**
- Modify: `Source/PoF/UI/DamageNumberWidget.cpp`

- [ ] **Step 1: Add a text shadow when the text block is created**

In `Source/PoF/UI/DamageNumberWidget.cpp`, inside `RebuildWidget()`, right after the `DamageText->SetJustification(ETextJustify::Center);` line (where `DamageText` is freshly constructed), add:

```cpp
				// A drop shadow keeps numbers readable over bright scenes — the
				// text analogue of the explicit-ProgressBar-style lesson.
				DamageText->SetShadowOffset(FVector2D(1.5f, 1.5f));
				DamageText->SetShadowColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, 0.85f));
```

(The block is guarded by `if (RootCanvas && !DamageText)`, so this runs once when the default tree is built.)

- [ ] **Step 2: Build the editor**

Run the build command.
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/UI/DamageNumberWidget.cpp
git commit -m @'
feat(ui): drop shadow on floating damage numbers for legibility

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 4: Guarantee the damage-number manager in `AVSHUD`

**Files:**
- Modify: `Source/PoF/UI/VSHUD.cpp`

**Why:** The manager is created by `AARPGPlayerController`, but `BP_VSGameMode`'s `PlayerControllerClass` is a binary asset we can't read. This idempotent guard makes damage numbers work regardless of the controller, and is a no-op if the controller already added one.

- [ ] **Step 1: Add the include**

In `Source/PoF/UI/VSHUD.cpp`, add to the include block near the top:
```cpp
#include "UI/DamageNumberManagerComponent.h"
#include "GameFramework/PlayerController.h"
```

- [ ] **Step 2: Ensure the component in BeginPlay**

In `AVSHUD::BeginPlay`, after the `HUDWidget` creation block and before the `TryBind();` call, insert:

```cpp
	// Guarantee floating damage numbers for the slice regardless of which
	// PlayerControllerClass BP_VSGameMode uses. Idempotent: a no-op if the
	// controller already created a DamageNumberManagerComponent.
	if (APlayerController* PC = GetOwningPlayerController())
	{
		if (!PC->FindComponentByClass<UDamageNumberManagerComponent>())
		{
			UDamageNumberManagerComponent* Mgr = NewObject<UDamageNumberManagerComponent>(PC);
			Mgr->RegisterComponent();
			UE_LOG(LogTemp, Log, TEXT("[VSHUD] added DamageNumberManagerComponent to controller"));
		}
	}
```

- [ ] **Step 3: Build the editor**

Run the build command.
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/UI/VSHUD.cpp
git commit -m @'
feat(ui): AVSHUD guarantees a DamageNumberManagerComponent on the controller

Idempotent find-or-add so floating numbers fire in the slice independent
of BP_VSGameMode's PlayerControllerClass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 5: Create the HUD functional test

**Files:**
- Create: `Source/PoF/Test/HUD/AVSHUDFunctionalTest.h`
- Create: `Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp`

**Note:** This single placed test covers the spec's three test intents as phases —
`HUDStructure` (tree-structure), `HUDBinding` (GAS bar binding), `DamageNumbers`
(end-to-end spawn). It uses the slice's real player/enemy ASCs via
`AARPGFunctionalTestBase`, avoiding fragile synthetic-ASC construction headless.

- [ ] **Step 1: Write the header**

`Source/PoF/Test/HUD/AVSHUDFunctionalTest.h`:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Test/ARPGFunctionalTestBase.h"
#include "AVSHUDFunctionalTest.generated.h"

class UVSHUDWidget;

/**
 * Vertical-slice HUD functional test (place one instance in /Game/Maps/VerticalSlice).
 * Phases: HUDStructure -> HUDBinding -> DamageNumbers.
 * Run: Project.Functional Tests.Maps.VerticalSlice.VSHUDFunctionalTest
 */
UCLASS()
class POF_API AVSHUDFunctionalTest : public AARPGFunctionalTestBase
{
	GENERATED_BODY()

public:
	AVSHUDFunctionalTest();

protected:
	virtual void OnTestStarted() override;
	virtual EARPGPhaseResult RunPhase(int32 PhaseIndex, FName PhaseName, float DeltaSeconds) override;

private:
	UPROPERTY()
	UVSHUDWidget* Widget = nullptr;
};
```

- [ ] **Step 2: Write the implementation**

`Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp`:

```cpp
#include "Test/HUD/AVSHUDFunctionalTest.h"
#include "UI/VSHUDWidget.h"
#include "UI/ARPGCodeWidgetBase.h"
#include "UI/DamageNumberWidget.h"
#include "Blueprint/WidgetTree.h"
#include "Components/ProgressBar.h"
#include "AbilitySystemComponent.h"
#include "UObject/UObjectIterator.h"

AVSHUDFunctionalTest::AVSHUDFunctionalTest()
{
	TimeLimit = 30.f;
	Phases = { TEXT("HUDStructure"), TEXT("HUDBinding"), TEXT("DamageNumbers") };
}

void AVSHUDFunctionalTest::OnTestStarted()
{
	// Build the slice HUD widget exactly as AVSHUD does.
	Widget = CreateWidget<UVSHUDWidget>(GetWorld(), UVSHUDWidget::StaticClass());
	if (Widget)
	{
		Widget->AddToViewport(UARPGCodeWidgetBase::DefaultHUDZOrder);
	}
}

EARPGPhaseResult AVSHUDFunctionalTest::RunPhase(int32 /*PhaseIndex*/, FName PhaseName, float DeltaSeconds)
{
	if (PhaseName == TEXT("HUDStructure"))
	{
		if (!AssertTrue(Widget != nullptr, TEXT("HUD widget created")))
		{
			return EARPGPhaseResult::Fail;
		}
		UWidgetTree* Tree = Widget->WidgetTree;
		if (!AssertTrue(Tree != nullptr, TEXT("HUD widget has a WidgetTree")))
		{
			return EARPGPhaseResult::Fail;
		}
		AssertTrue(Tree->FindWidget(TEXT("PlayerHealthBar"))  != nullptr, TEXT("PlayerHealthBar exists"));
		AssertTrue(Tree->FindWidget(TEXT("EnemyHealthBar"))   != nullptr, TEXT("EnemyHealthBar exists"));
		AssertTrue(Tree->FindWidget(TEXT("PlayerHealthText")) != nullptr, TEXT("PlayerHealthText exists"));
		AssertTrue(Tree->FindWidget(TEXT("EnemyHealthText"))  != nullptr, TEXT("EnemyHealthText exists"));
		AssertTrue(Tree->FindWidget(TEXT("EnemyNameText"))    != nullptr, TEXT("EnemyNameText exists"));
		return EARPGPhaseResult::Advance;
	}

	if (PhaseName == TEXT("HUDBinding"))
	{
		if (IsFirstTickOfPhase(DeltaSeconds))
		{
			Widget->BindEnemy(GetEnemyASC(), TEXT("Enemy"));
			ApplyDamage(GetFirstEnemy(), 25.f); // non-lethal
		}
		UProgressBar* Bar = Cast<UProgressBar>(Widget->WidgetTree->FindWidget(TEXT("EnemyHealthBar")));
		const EARPGWait W = WaitForCondition(
			[Bar]() { return Bar != nullptr && Bar->GetPercent() < 0.999f; }, 3.f);
		if (W == EARPGWait::Satisfied)
		{
			AssertTrue(true, TEXT("enemy health bar updated on damage"));
			return EARPGPhaseResult::Advance;
		}
		if (W == EARPGWait::TimedOut)
		{
			AssertTrue(false, TEXT("enemy health bar did not update within 3s"));
			return EARPGPhaseResult::Fail;
		}
		return EARPGPhaseResult::Running;
	}

	if (PhaseName == TEXT("DamageNumbers"))
	{
		if (IsFirstTickOfPhase(DeltaSeconds))
		{
			ApplyDamage(GetFirstEnemy(), 20.f);
		}
		const EARPGWait W = WaitForCondition([]()
		{
			for (TObjectIterator<UDamageNumberWidget> It; It; ++It)
			{
				if (IsValid(*It) && It->IsInViewport())
				{
					return true;
				}
			}
			return false;
		}, 3.f);
		if (W == EARPGWait::Satisfied)
		{
			AssertTrue(true, TEXT("floating damage number spawned + in viewport"));
			return EARPGPhaseResult::Advance;
		}
		if (W == EARPGWait::TimedOut)
		{
			AssertTrue(false, TEXT("no floating damage number appeared within 3s"));
			return EARPGPhaseResult::Fail;
		}
		return EARPGPhaseResult::Running;
	}

	return EARPGPhaseResult::Advance;
}
```

- [ ] **Step 3: Build the editor**

Run the build command.
Expected: `BUILD SUCCESSFUL`. (If `AssertTrue` returns void in this engine version, drop the `if (!AssertTrue(...))` guards and call `AssertTrue(...)` then `if (!Widget) return EARPGPhaseResult::Fail;` instead.)

- [ ] **Step 4: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Source/PoF/Test/HUD/AVSHUDFunctionalTest.h Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp
git commit -m @'
test(ui): AVSHUDFunctionalTest — HUD structure, GAS binding, damage numbers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 6: Place the test in the slice map and run it

**Files:**
- Create: `Content/Python/place_hud_test.py`
- Modified by the script: `Content/Maps/VerticalSlice.umap` (binary)

- [ ] **Step 1: Write the placement script**

`Content/Python/place_hud_test.py`:

```python
import unreal

MAP_PATH = "/Game/Maps/VerticalSlice"

unreal.EditorLoadingAndSavingUtils.load_map(MAP_PATH)

actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
already = [a for a in actor_subsystem.get_all_level_actors()
           if a.get_class().get_name() == "VSHUDFunctionalTest"]

if already:
    unreal.log("place_hud_test: VSHUDFunctionalTest already present — nothing to do")
else:
    actor_subsystem.spawn_actor_from_class(
        unreal.VSHUDFunctionalTest, unreal.Vector(0.0, 0.0, 200.0))
    unreal.EditorLoadingAndSavingUtils.save_current_level()
    unreal.log("place_hud_test: spawned VSHUDFunctionalTest and saved the level")
```

- [ ] **Step 2: Run the script in the editor**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\place_hud_test.py" -unattended -nopause
```
Expected log line: `place_hud_test: spawned VSHUDFunctionalTest and saved the level`.

- [ ] **Step 3: Run the functional test**

```powershell
& "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSHUDFunctionalTest;Quit" -unattended -nopause -nullrhi -log
```
Expected: `Test Completed. Result={Success}`, and the log shows the three phase asserts passing. If `Result={Failure}`:
- `enemy health bar did not update` → check the reparent (Task 2) preserved the `BindEnemy`/`RefreshEnemyBar` path and the `EnemyHealthBar` FName.
- `no floating damage number` → confirm Task 4's guard ran (`[VSHUD] added DamageNumberManagerComponent` or the controller already had one) and that `OnDamageNumberRequestedGlobal` fired (it broadcasts in `ARPGAttributeSet::PostGameplayEffectExecute`).

- [ ] **Step 4: Commit (UE repo)**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git add Content/Python/place_hud_test.py Content/Maps/VerticalSlice.umap
git commit -m @'
test(ui): place VSHUDFunctionalTest in the slice map (passing)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 7: Push the UE project

- [ ] **Step 1: Push to pof-exp**

```powershell
cd "C:\Users\kazda\Documents\Unreal Projects\PoF"
git push
```
Expected: push succeeds (this repo's pushes work, unlike the PoF app repo).

---

## Task 8: PoF app — write the failing prompt test (TDD red)

**Files:**
- Create: `src/__tests__/lib/arpg-ui-prompt.test.ts`

Working dir: `C:\Users\kazda\kiro\pof`.

- [ ] **Step 1: Write the test**

`src/__tests__/lib/arpg-ui-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';
import type { ChecklistItem } from '@/types/modules';

function uiItem(id: string): ChecklistItem {
  const list = (ARPG_CHECKLISTS as Record<string, ChecklistItem[]>)['arpg-ui'];
  const item = list?.find((x) => x.id === id);
  if (!item) throw new Error(`No arpg-ui checklist item ${id}`);
  return item;
}

describe('arpg-ui HUD prompts default to the pure-C++ widget pattern', () => {
  it('au-1 instructs RebuildWidget-based tree construction', () => {
    expect(uiItem('au-1').prompt).toMatch(/RebuildWidget/);
  });

  it('au-1 forbids BindWidget for the slice HUD', () => {
    const p = uiItem('au-1').prompt;
    expect(p).toMatch(/BindWidget/);
    expect(p).toMatch(/do not use `?BindWidget`?|don't use `?BindWidget`?|no companion Widget Blueprint/i);
  });

  it('au-1 requires an explicit ProgressBar style (dark track + bright fill)', () => {
    const p = uiItem('au-1').prompt;
    expect(p).toMatch(/ProgressBar/);
    expect(p).toMatch(/FProgressBarStyle|dark track/i);
  });

  it('au-7 references the pure-C++ damage-number manager + widget pattern', () => {
    const p = uiItem('au-7').prompt;
    expect(p).toMatch(/RebuildWidget/);
    expect(p).toMatch(/BindWidgetOptional/);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

```powershell
npx vitest run src/__tests__/lib/arpg-ui-prompt.test.ts
```
Expected: failures (current `au-1`/`au-7` prompts contain none of `RebuildWidget`, `FProgressBarStyle`, `BindWidgetOptional`).

---

## Task 9: PoF app — update `arpg-ui` prompts + knowledge tips (TDD green)

**Files:**
- Modify: `src/lib/module-registry.ts`

- [ ] **Step 1: Replace the `au-1` prompt**

In `src/lib/module-registry.ts`, find the `au-1` item (in `ARPG_CHECKLISTS['arpg-ui']`) and replace its `prompt` string with:

```
Create the main HUD widget for my aRPG as a pure-C++ UUserWidget — no companion Widget Blueprint, and do not use BindWidget. Build the widget tree in RebuildWidget() (before Super::RebuildWidget()), NOT in NativeConstruct() (which runs after the Slate tree is built, so WidgetTree mutations there do not render). Layout: top-left player health bar (green) and top-centre enemy/target health bar (red), each with numeric values. Style every UProgressBar with an explicit FProgressBarStyle — a dark track (BackgroundImage) and a bright fill (FillImage) — because an empty ProgressBar is invisible with the engine default. Bind to GAS attribute-change delegates (GetGameplayAttributeValueChangeDelegate) for real-time updates. Use UVSHUDWidget as the reference implementation.
```

- [ ] **Step 2: Replace the `au-7` prompt**

Find the `au-7` item and replace its `prompt` string with:

```
Implement floating damage numbers for my aRPG. Reference pattern: a UDamageNumberManagerComponent on the player controller auto-subscribes to a global damage delegate and spawns a UDamageNumberWidget per hit. Make UDamageNumberWidget a pure-C++ widget — build its tree in RebuildWidget() and mark the text block UPROPERTY(meta=(BindWidgetOptional)) so it works without a Widget Blueprint. When damage is dealt: spawn at the hit location in screen space, color by type (white=physical, red=fire, blue=ice, yellow=lightning), float upward and fade out over 1 second. Critical hits show larger text with a "CRIT!" prefix; heal numbers show green with a "+" prefix.
```

- [ ] **Step 3: Populate `arpg-ui` `knowledgeTips`**

Find the `arpg-ui` entry in `SUB_MODULES` (`id: 'arpg-ui'`) and replace `knowledgeTips: [],` with:

```ts
    knowledgeTips: [
      {
        title: 'Build code-only widget trees in RebuildWidget(), not NativeConstruct()',
        content: 'For a pure-C++ UUserWidget (no Widget Blueprint), construct the WidgetTree inside RebuildWidget() before calling Super::RebuildWidget(). NativeConstruct() runs after the Slate tree is already built, so mutating WidgetTree there has no visible effect — a common cause of "the widget compiles but nothing renders".',
        source: 'feasibility',
      },
      {
        title: 'An empty UProgressBar is invisible without an explicit FProgressBarStyle',
        content: 'The engine default ProgressBar has a transparent background image, so an empty or low bar renders as nothing. Set an explicit style with a dark track (BackgroundImage) and a bright fill (FillImage) so the bar is visible at any percent.',
        source: 'feasibility',
      },
      {
        title: 'AddOnScreenDebugMessage overlays the whole viewport',
        content: 'GEngine->AddOnScreenDebugMessage draws above all UMG and confounds screenshot/vision verification of the HUD. Suppress debug text in tests, and add slice HUD widgets at Z-order 30 so they sit above the main HUD layers.',
        source: 'best-practice',
      },
    ],
```

- [ ] **Step 4: Run the prompt test — expect PASS**

```powershell
npx vitest run src/__tests__/lib/arpg-ui-prompt.test.ts
```
Expected: all 4 tests pass.

- [ ] **Step 5: Run full validation**

```powershell
npm run validate
```
Expected: typecheck + lint + test all pass.

- [ ] **Step 6: Commit LOCALLY (PoF app — DO NOT push)**

Stage only the two files this task touched:

```powershell
cd "C:\Users\kazda\kiro\pof"
git add src/lib/module-registry.ts src/__tests__/lib/arpg-ui-prompt.test.ts
git commit -m @'
feat(registry): arpg-ui defaults to pure-C++ HUD widget pattern

au-1/au-7 prompts + knowledge tips encode RebuildWidget-timing, explicit
ProgressBar styling, BindWidgetOptional, and the debug-text/z-order gotcha.
Guarded by a new arpg-ui prompt vitest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```
Do NOT run `git push` for this repo.

---

## Self-Review

**Spec coverage:**
- Game §1 `UARPGCodeWidgetBase` → Task 1. ✔
- Game §2 reparent `UVSHUDWidget` → Task 2. ✔
- Game §3 damage-number guarantee in `AVSHUD` → Task 4. ✔
- Game §4 damage-number legibility polish → Task 3. ✔
- Tests (tree-structure, bar-binding, damage-number) → Task 5/6 as the three phases of `AVSHUDFunctionalTest`. ✔ (consolidation noted in Task 5)
- App `arpg-ui` `au-1`/`au-7` + knowledge tips → Task 9. ✔
- App prompt regression vitest → Task 8 (red) + Task 9 (green). ✔
- Out-of-scope (boss widget, player-damage HUD reactions) → not implemented, by design. ✔

**Placeholder scan:** No TBD/TODO; every code/edit step shows the exact content. Engine paths flagged as "adjust to your install" (a real environment variable, not a content placeholder).

**Type/name consistency:** Base method names (`BuildTree`, `MakeBarStyle`, `CreateStyledProgressBar`, `AnchorTopLeft/Centre`, `DefaultHUDZOrder`) are identical across Tasks 1, 2, 5. Widget FNames (`PlayerHealthBar`, `EnemyHealthBar`, `PlayerHealthText`, `EnemyHealthText`, `EnemyNameText`) match between the reparent (Task 2) and the test's `FindWidget` calls (Task 5). Test class `AVSHUDFunctionalTest` → Python `unreal.VSHUDFunctionalTest` → automation path `...Maps.VerticalSlice.VSHUDFunctionalTest` are consistent across Tasks 5/6. The vitest regexes in Task 8 are all satisfied by the exact prompt strings in Task 9.
