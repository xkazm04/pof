# HUD/UI folder-04 — game-side reparent + hotbar + hit indicator + debug-cvar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: this plan is executed **inline** (UE C++ cannot be compiled in this environment; build/verify is the operator's step). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining game-side items of `docs/improvements/04-hud-ui` — §3 ability hotbar, §4 hit indicator, §5 reparent the `UARPGHUDWidget` family to `UARPGCodeWidgetBase` (chosen path: reparent-to-code), §6 gate engine debug text behind a cvar — plus the one app-side follow-up (name `UARPGCodeWidgetBase` in the `arpg-ui` prompts).

**Architecture:** Each BindWidget-coupled family widget keeps its existing bind/tick/update logic and only changes how its named children come into being: base class `UUserWidget → UARPGCodeWidgetBase`, drop `meta=(BindWidget)`, and construct the same-named members in a `BuildTree()` override (which `UARPGCodeWidgetBase::RebuildWidget()` calls before the Slate tree is built). `AARPGHUD` is made slice-self-sufficient (defaults its slice widget classes to the C++ classes), so it works with no WBP. §3 is delivered *as* the reparented `UAbilityBarWidget`/`UAbilitySlotWidget` (a throwaway `UVSAbilityBarWidget` would be redundant). §4 is a full-screen vignette image on the reparented `UARPGHUDWidget`, driven by its existing GAS health callback.

**Tech Stack:** UE5 C++ (UMG, GAS, Slate brushes), `TAutoConsoleVariable`, the project's `AARPGFunctionalTestBase` test harness; PoF app TypeScript (registry prompt + vitest).

**Two hard constraints (see memory `ue-shared-concurrency`, `ue-project-git`):**
1. The UE editor C++ module build is **monolithic and shared by ~8 concurrent CLIs** — a non-compiling `.cpp` I commit breaks *everyone's* build. Therefore **UE C++ is written to files but NOT committed until the operator's `Build.bat PoFEditor` is green.** App-repo (TS/docs) changes are verifiable here and commit normally (locally; the user pushes).
2. Commit **narrowly by exact path** — never `git add -A`/`.`. The tree always holds other CLIs' WIP.

**Repos:** UE game = `C:\Users\kazda\Documents\Unreal Projects\PoF` (`xkazm04/pof-exp`, branch `main`). PoF app = `C:\Users\kazda\kiro\pof` (`master`).

---

## File map

| File | Change |
|------|--------|
| `Source/PoF/Character/ARPGCharacterBase.cpp` | §6: register `ARPG.ShowDebugStats` cvar; gate the stamina debug block |
| `Source/PoF/Player/ARPGPlayerCharacter.cpp` | §6: gate the HP/MP/Lv/interact/dead/aim debug block on the cvar |
| `Source/PoF/UI/ARPGCodeWidgetBase.h/.cpp` | §3/§4: add `AnchorBottomCentre`, `CreateImage` helpers |
| `Source/PoF/UI/AbilitySlotWidget.h/.cpp` | §3/§5: reparent to code; `BuildTree()`; default tolerates null sweep material |
| `Source/PoF/UI/AbilityBarWidget.h/.cpp` | §3/§5: reparent to code; `BuildTree()` builds bottom-centre `SlotContainer`; default `SlotWidgetClass` |
| `Source/PoF/UI/EnemyHealthBarWidget.h/.cpp` | §5: reparent to code; `BuildTree()` |
| `Source/PoF/UI/ARPGHUDWidget.h/.cpp` | §5: reparent to code; `BuildTree()`; §4: add `HitVignette` + flash on health drop |
| `Source/PoF/UI/ARPGHUD.cpp` | §5: default `HUDWidgetClass`/`AbilityBarClass` to the C++ classes in ctor |
| `Source/PoF/Test/HUD/ARPGHUDWidgetTest.{h,cpp}` (new) | tests: presence/structure/binding/hotbar-slots/hit-vignette for the real HUD |
| `Tools/set_vs_gamemode_hud.py` (new, UE repo) | **gated** §5: set `BP_VSGameMode.HUDClass = AARPGHUD` in-editor |
| `src/lib/module-registry.ts` (app) | app §1: name `UARPGCodeWidgetBase` as the parent in `au-1/3/4/7/8` |
| `src/__tests__/lib/arpg-ui-prompt.test.ts` (app) | assert the prompt names `UARPGCodeWidgetBase` |
| `docs/improvements/04-hud-ui/*.md`, memory | status update |

---

## Task 1: §6 — gate engine debug text behind `ARPG.ShowDebugStats`

**Files:**
- Modify: `Source/PoF/Character/ARPGCharacterBase.cpp` (~227-245)
- Modify: `Source/PoF/Player/ARPGPlayerCharacter.cpp` (~631-665)

Register the cvar **once** (in `ARPGCharacterBase.cpp` file scope) and read it from both files via `IConsoleManager` (avoids a duplicate-registration crash).

- [ ] **Step 1: Register cvar + gate the stamina block** (`ARPGCharacterBase.cpp`)

Add near the top of the file (after includes):
```cpp
// HUD/UI §6: engine on-screen debug stats are OFF by default; flip on per dev
// session with `ARPG.ShowDebugStats 1`. They draw above all UMG and pin to the
// corner, confounding HUD vision checks.
TAutoConsoleVariable<int32> CVarARPGShowDebugStats(
	TEXT("ARPG.ShowDebugStats"), 0,
	TEXT("Show on-screen debug stats (stamina/HP/MP/level). 0 = off (default), 1 = on."),
	ECVF_Default);
```
Change the block guard from `if (GEngine)` to also require the cvar:
```cpp
#if !UE_BUILD_SHIPPING
	// Debug stamina display (gated — see ARPG.ShowDebugStats)
	if (GEngine && CVarARPGShowDebugStats.GetValueOnGameThread() != 0)
	{
		... existing body unchanged ...
	}
#endif
```

- [ ] **Step 2: Gate the player debug block** (`ARPGPlayerCharacter.cpp`)

At the top of `UpdateDebugDisplay`, read the shared cvar by name and early-out:
```cpp
void AARPGPlayerCharacter::UpdateDebugDisplay(float DeltaTime)
{
#if !UE_BUILD_SHIPPING
	if (!GEngine) return;
	static IConsoleVariable* CVarShow =
		IConsoleManager::Get().FindConsoleVariable(TEXT("ARPG.ShowDebugStats"));
	if (CVarShow && CVarShow->GetInt() == 0) return;
	... existing body unchanged ...
#endif
}
```

- [ ] **Step 3 (operator):** Build verifies. Then commit narrowly:
```bash
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" add Source/PoF/Character/ARPGCharacterBase.cpp Source/PoF/Player/ARPGPlayerCharacter.cpp
git -C "..." commit -m "feat(hud): gate engine debug stats behind ARPG.ShowDebugStats cvar (folder-04 §6)"
```

---

## Task 2: App §1 — name `UARPGCodeWidgetBase` in the `arpg-ui` prompts (VERIFIABLE HERE)

**Files:**
- Modify: `src/lib/module-registry.ts` (`au-1/3/4/7/8` prompts)
- Modify/extend test: `src/__tests__/lib/arpg-ui-prompt.test.ts`

The class now exists in the UE repo, so the prompts should name it as the parent (currently `au-1` only says "Use `UVSHUDWidget` as the reference implementation").

- [ ] **Step 1:** In each pure-C++ prompt (`au-1`, `au-3`, `au-4`, `au-7`, `au-8`), replace the opening "as a pure-C++ `UUserWidget`" with "as a pure-C++ widget extending **`UARPGCodeWidgetBase`** (override `BuildTree()`; use its `CreateStyledProgressBar`/`CreateStyledTextBlock`/`AnchorTopLeft`/`AnchorTopCentre` helpers)". Keep the existing BindWidget-forbid + RebuildWidget reminders. Keep `UVSHUDWidget`/`UDamageNumberWidget` as reference mentions.

- [ ] **Step 2:** Add/adjust assertion in `arpg-ui-prompt.test.ts`: each visualCheck prompt mentions `UARPGCodeWidgetBase`.

- [ ] **Step 3:** `npx vitest run src/__tests__/lib/arpg-ui-prompt.test.ts` → PASS.

- [ ] **Step 4:** Commit (app repo, local): `git add src/lib/module-registry.ts src/__tests__/lib/arpg-ui-prompt.test.ts && git commit -m "feat(arpg-ui): name UARPGCodeWidgetBase as the pure-C++ widget parent (folder-04 §1)"`

---

## Task 3: Base-class helpers for hotbar + hit indicator

**Files:** `Source/PoF/UI/ARPGCodeWidgetBase.h/.cpp`

- [ ] **Step 1:** Add two protected helpers (header), declare `class UImage;`:
```cpp
/** Add Child anchored+aligned bottom-centre. bAutoSize ignores Size. */
static UCanvasPanelSlot* AnchorBottomCentre(UCanvasPanel* Canvas, UWidget* Child,
	FVector2D Position, FVector2D Size, bool bAutoSize = false);

/** Construct a UImage into WidgetTree with a solid-colour brush. */
UImage* CreateImage(FName Name, const FLinearColor& Colour);
```

- [ ] **Step 2:** Implement (`.cpp`), mirroring `AnchorTopCentre` but with `FAnchors(0.5f, 1.f)` + alignment `(0.5f, 1.f)`; `CreateImage` constructs `UImage`, sets `SetBrush(MakeSolidBrush(Colour))`. Add `#include "Components/Image.h"`.

- [ ] (operator builds with Task 4-8 batch; commit grouped — see Task 8.)

---

## Task 4: Reparent `UAbilitySlotWidget` to code

**Files:** `Source/PoF/UI/AbilitySlotWidget.h/.cpp`

- [ ] **Step 1 (header):** `#include "UI/ARPGCodeWidgetBase.h"`; base `UUserWidget → UARPGCodeWidgetBase`; remove `meta=(BindWidget)` from `AbilityIcon`/`CooldownSweep`/`CooldownText`/`ManaCostText`/`KeybindLabel` (keep them as plain `UPROPERTY()` members); add `protected: virtual void BuildTree() override;`. Keep all public setters + `CooldownSweepMaterial` + `SweepMID`.

- [ ] **Step 2 (.cpp `BuildTree`):** construct a root `UCanvasPanel`; an `UOverlay` (or stacked canvas) sized ~64×64 containing, in order: `AbilityIcon` (UImage, neutral fill), `CooldownSweep` (UImage, semi-transparent black `FLinearColor(0,0,0,0.6)`, render-opacity 0), `CooldownText` (centre), `ManaCostText` (bottom-right), `KeybindLabel` (top-left). Assign `WidgetTree->RootWidget`. Guard `if (AbilityIcon) return;` for idempotency.

- [ ] **Step 3 (.cpp `NativeConstruct`):** unchanged logic, but it already guards `if (CooldownSweep && CooldownSweepMaterial)` — with no material the sweep stays a plain darkening image. In `SetCooldownPercent`, when `SweepMID` is null, drive the gray-box cooldown by `CooldownSweep->SetRenderOpacity(Percent > 0 ? 0.6f : 0.f)` (keep the existing material path when present).

- [ ] (commit grouped — Task 8.)

---

## Task 5: Reparent `UAbilityBarWidget` to code (delivers §3 hotbar)

**Files:** `Source/PoF/UI/AbilityBarWidget.h/.cpp`

- [ ] **Step 1 (header):** `#include "UI/ARPGCodeWidgetBase.h"`; base → `UARPGCodeWidgetBase`; remove `meta=(BindWidget)` from `SlotContainer` (keep as `UPROPERTY() TObjectPtr<UHorizontalBox> SlotContainer;`); add `virtual void BuildTree() override;`. Add a default for the slot class in the ctor (declare `UAbilityBarWidget(const FObjectInitializer&)` or set in `NativeOnInitialized`).

- [ ] **Step 2 (.cpp):** default `SlotWidgetClass` to `UAbilitySlotWidget::StaticClass()` (in a constructor body). `BuildTree`: construct root `UCanvasPanel`; construct `SlotContainer = WidgetTree->ConstructWidget<UHorizontalBox>(...)`; `AnchorBottomCentre(Canvas, SlotContainer, FVector2D(0,-24), FVector2D(360,72), /*bAutoSize*/true)`. `#include "Components/HorizontalBox.h"`, `#include "Components/CanvasPanel.h"`, `#include "Blueprint/WidgetTree.h"`. Guard idempotency `if (SlotContainer) return;`.

- [ ] **Step 3:** `NativeConstruct` / `CreateSlotWidgets` / `UpdateCooldowns` / `RefreshFromLoadout` unchanged — `SlotContainer` and `SlotWidgetClass` are now both valid by the time `NativeConstruct` runs (BuildTree precedes it).

- [ ] (commit grouped — Task 8.)

---

## Task 6: Reparent `UEnemyHealthBarWidget` to code

**Files:** `Source/PoF/UI/EnemyHealthBarWidget.h/.cpp`

- [ ] **Step 1 (header):** `#include "UI/ARPGCodeWidgetBase.h"`; base → `UARPGCodeWidgetBase`; drop `meta=(BindWidget)` from `HealthBar`/`EnemyNameText`/`LevelText`/`HealthText`; add `virtual void BuildTree() override;`.

- [ ] **Step 2 (.cpp `BuildTree`):** root `UCanvasPanel`; vertical layout (or canvas-positioned): `EnemyNameText` (top), `LevelText`, `HealthBar` via `CreateStyledProgressBar("HealthBar", BarColor)`, `HealthText` overlaid. Size ~200×56. Assign root. Idempotency guard `if (HealthBar) return;`.

- [ ] **Step 3:** `NativeConstruct` sets opacity 0 + fill colour (unchanged); `NativeTick` fade state machine unchanged.

- [ ] (commit grouped — Task 8.)

---

## Task 7: Reparent `UARPGHUDWidget` to code + §4 hit indicator

**Files:** `Source/PoF/UI/ARPGHUDWidget.h/.cpp`

- [ ] **Step 1 (header):** `#include "UI/ARPGCodeWidgetBase.h"`; base → `UARPGCodeWidgetBase`; drop `meta=(BindWidget)` from `HealthBar`,`HealthText`,`ManaBar`,`ManaText`,`StaminaBar`,`XPBar`,`LevelText`,`MinimapPlaceholder`; add `virtual void BuildTree() override;`. Add `UPROPERTY() TObjectPtr<UImage> HitVignette;` and `float HitFlashAlpha = 0.f;` + `UPROPERTY(EditAnywhere) float HitFlashDecay = 4.f;` (≈250 ms).

- [ ] **Step 2 (.cpp `BuildTree`):** root `UCanvasPanel`. Add `HitVignette = CreateImage("HitVignette", FLinearColor(0.8f,0.f,0.f,1.f))` anchored full-screen (`FAnchors(0,0,1,1)`, offsets 0, render-opacity 0) FIRST (behind). Then a top-left block: `HealthBar` (green) + `HealthText`, `ManaBar` (blue) + `ManaText`, `StaminaBar` (gold). XP block bottom or under bars: `XPBar` (purple) + `LevelText`. `MinimapPlaceholder` = `UBorder` top-right. Use `CreateStyledProgressBar`/`CreateStyledTextBlock`. Idempotency guard `if (HealthBar) return;`.

- [ ] **Step 3 (§4 flash):** in the existing `OnHealthChanged(const FOnAttributeChangeData& Data)`, when `Data.NewValue < CurrentHealth` (damage), set `HitFlashAlpha = 0.7f`. In `NativeTick`, decay: `HitFlashAlpha = FMath::FInterpTo(HitFlashAlpha, 0.f, InDeltaTime, HitFlashDecay); if (HitVignette) HitVignette->SetRenderOpacity(HitFlashAlpha);`. (Reads the GAS callback already wired — no dependency on the player `OnHealthChanged` dynamic delegate.)

- [ ] **Step 4:** keep `NativeConstruct` fill-colour setup, `NativeTick` interpolation/pulse, `BindToAbilitySystem`/`BindToPlayerCharacter` unchanged.

- [ ] (commit grouped — Task 8.)

---

## Task 8: Make `AARPGHUD` slice-self-sufficient (no WBP needed)

**Files:** `Source/PoF/UI/ARPGHUD.cpp` (add a constructor; header already declares none → add `AARPGHUD();` to `ARPGHUD.h`)

- [ ] **Step 1:** Add ctor defaulting the slice widget classes so `BeginPlay`'s `if (HUDWidgetClass)` / `if (AbilityBarClass)` succeed with the C++ classes when no Blueprint overrides them:
```cpp
AARPGHUD::AARPGHUD()
{
	HUDWidgetClass  = UARPGHUDWidget::StaticClass();
	AbilityBarClass = UAbilityBarWidget::StaticClass();
}
```
(`#include "UI/ARPGHUDWidget.h"`, `#include "UI/AbilityBarWidget.h"`.) Leave the other screen classes null (absent in the slice; reparent in a follow-up).

- [ ] **Step 2 (operator):** **Build the whole batch (Tasks 1,3–8).** `Build.bat PoFEditor` must be green (editor closed / Live Coding off for the new members). Only then commit narrowly:
```bash
git -C "<UE>" add Source/PoF/UI/ARPGCodeWidgetBase.h Source/PoF/UI/ARPGCodeWidgetBase.cpp \
  Source/PoF/UI/AbilitySlotWidget.h Source/PoF/UI/AbilitySlotWidget.cpp \
  Source/PoF/UI/AbilityBarWidget.h Source/PoF/UI/AbilityBarWidget.cpp \
  Source/PoF/UI/EnemyHealthBarWidget.h Source/PoF/UI/EnemyHealthBarWidget.cpp \
  Source/PoF/UI/ARPGHUDWidget.h Source/PoF/UI/ARPGHUDWidget.cpp \
  Source/PoF/UI/ARPGHUD.h Source/PoF/UI/ARPGHUD.cpp
git -C "<UE>" commit -m "feat(hud): reparent ARPGHUD widget family to UARPGCodeWidgetBase + code hotbar + hit vignette (folder-04 §3/§4/§5)"
```

---

## Task 9: UE functional test for the reparented real HUD

**Files:** new `Source/PoF/Test/HUD/ARPGHUDWidgetTest.{h,cpp}` (subclass `AARPGFunctionalTestBase`)

- [ ] **Step 1:** Phases `{ "HUDStructure", "Hotbar", "HitVignette", "HUDBinding" }`. `OnTestStarted`: `CreateWidget<UARPGHUDWidget>` + `AddToViewport(0)`; also create+viewport a `UAbilityBarWidget`.
- [ ] **Step 2 — HUDStructure:** assert `GetWidgetFromName("HealthBar"/"ManaBar"/"StaminaBar"/"XPBar"/"LevelText")` non-null.
- [ ] **Step 3 — Hotbar:** after `RefreshFromLoadout(GetPlayerCharacter())`, assert `SlotContainer` has ≥1 child (walk `GetWidgetFromName("SlotContainer")` → `UPanelWidget::GetChildrenCount() > 0`).
- [ ] **Step 4 — HitVignette:** `BindToAbilitySystem(GetPlayerASC())`; `ApplyDamage(GetPlayerCharacter(), 10.f)`; `WaitForCondition` that `Cast<UImage>(GetWidgetFromName("HitVignette"))->GetRenderOpacity() > 0.f` within 1 s.
- [ ] **Step 5 — HUDBinding:** apply damage; assert `HealthBar` percent < 0.999 within 3 s.
- [ ] **Step 6 (operator):** build green → commit `git add Source/PoF/Test/HUD/ARPGHUDWidgetTest.* && git commit -m "test(hud): functional test for reparented real HUD — structure/hotbar/vignette/binding (folder-04 tests)"`.

Leave `AVSHUDFunctionalTest` untouched (still valid; `UVSHUDWidget` not yet retired).

---

## Task 10: GATED — switch the slice to `AARPGHUD` + retire `UVSHUDWidget`

**Do ONLY after the operator confirms (build + a launch/Gemini check) the reparented `AARPGHUD` renders the player bar + hotbar correctly.** Until then, the slice stays on the known-good `AVSHUD`/`UVSHUDWidget`.

**Files:** new `Tools/set_vs_gamemode_hud.py` (UE repo); then delete `Source/PoF/UI/VSHUD.{h,cpp}`, `Source/PoF/UI/VSHUDWidget.{h,cpp}`; migrate/replace `Source/PoF/Test/HUD/AVSHUDFunctionalTest.*` (re-point to `UARPGHUDWidget`) or delete in favour of Task 9's test.

- [ ] **Step 1:** Write `set_vs_gamemode_hud.py` (idempotent): load `/Game/VerticalSlice/BP_VSGameMode`, set its `HUDClass` (note Python drops the leading `b`; this is a plain `HUDClass` so no prefix issue) to `AARPGHUD`, save. Operator runs it in-editor.
- [ ] **Step 2:** Remove `UVSHUDWidget`/`AVSHUD`; update `AVSHUDFunctionalTest` (or replace by Task 9). Search for residual refs: `grep -rn "VSHUD" Source/`.
- [ ] **Step 3 (operator):** build green + Gemini-confirm → commit narrowly.

---

## Task 11: Docs + memory status update (app repo)

- [ ] Update `docs/improvements/04-hud-ui/game.md` + `tests.md` "current state" notes: §1/§2 already done; §3/§4/§5(partial)/§6 delivered; §5 full retire is Task 10 (gated). Mark app §1 follow-up done.
- [ ] Update memory `project_improvements_04_hud_ui.md`.
- [ ] Commit (app repo, local): `git add docs/improvements/04-hud-ui && git commit -m "docs(improvements): folder-04 HUD/UI game-side reparent status"`.

---

## Self-review notes

- **Spec coverage:** app §1 (T2) ✓; game §1 already shipped; game §2 already shipped; §3 (T4+T5 reparent = code hotbar) ✓; §4 (T7 vignette) ✓; §5 reparent (T4–T8) ✓ + retire gated (T10) ✓; §6 (T1) ✓; UE tests (T9) ✓; app tests already shipped; e2e already shipped.
- **§3 deviation (intentional):** spec named a new `UVSAbilityBarWidget`; reparenting the real `UAbilityBarWidget` to code achieves the same visible hotbar without a throwaway class that §5 would immediately retire. Documented in T11.
- **Risk gating:** no UE C++ committed before the operator's build is green (monolithic shared build); the destructive retire (T10) is gated on a confirmed render.
- **Type consistency:** `BuildTree()` (base hook) overridden in every reparented widget; `AnchorBottomCentre`/`CreateImage` declared in T3 and used in T5/T7; `HitVignette` named consistently (T7 build, T9 test assert).
