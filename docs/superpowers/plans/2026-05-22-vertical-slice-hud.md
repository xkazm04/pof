# Vertical-Slice HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ARPG vertical slice a visible combat HUD — a player health bar and a live enemy health bar — built entirely in C++.

**Architecture:** Two new C++ classes in the UE project: `UVSHUDWidget` (a `UUserWidget` that builds its widget tree programmatically in code — the project's `UBossHealthBarWidget` pattern, no `BindWidget`, no UMG editor) and `AVSHUD` (a minimal `AHUD` that creates the widget, adds it to the viewport, and binds it to the player's and the enemy's GAS ability systems). A UE Python script sets `HUDClass` on `BP_VSGameMode` so UE spawns the HUD. Verified by the PS-1 functional test (gameplay intact) plus a Gemini check on a real-launch screenshot (HUD visible).

**Tech Stack:** UE 5.7 C++ (UMG — `UUserWidget`, `WidgetTree`, `UCanvasPanel`/`UProgressBar`/`UTextBlock`; `AHUD`; GAS attribute delegates), `unreal` Python, `UnrealEditor-Cmd`, the Leonardo skill's `gemini-recognize.mjs`.

**Spec:** `docs/superpowers/specs/2026-05-22-vertical-slice-hud-design.md`

---

## Planning-time facts (from the HUD inventory)

- UE5.7 project `C:\Users\kazda\Documents\Unreal Projects\PoF` — a git repo (remote `github.com/xkazm04/pof-exp`). C++ under `Source\PoF\`; HUD/UI classes under `Source\PoF\UI\`. The PoF app repo (git, Bash working dir) is `C:\Users\kazda\kiro\pof`.
- **`UBossHealthBarWidget`** (`Source\PoF\UI\BossHealthBarWidget.{h,cpp}`) is the reference: a `UUserWidget` with **zero `BindWidget`** that builds its whole widget tree in C++ via `WidgetTree->ConstructWidget<>()`. Mirror its tree-construction idiom exactly (it is known-good for this engine version).
- Health is a GAS attribute: `UARPGAttributeSet` (`Source\PoF\AbilitySystem\ARPGAttributeSet.h`) has `Health` and `MaxHealth` with `ATTRIBUTE_ACCESSORS` — so `UARPGAttributeSet::GetHealthAttribute()` / `GetMaxHealthAttribute()` exist. Bind via `ASC->GetGameplayAttributeValueChangeDelegate(UARPGAttributeSet::GetHealthAttribute()).AddUObject(this, &Handler)`; the handler signature is `void(const FOnAttributeChangeData&)`. Read the current value with `ASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute())`.
- Player: `AARPGPlayerCharacter` : `AARPGCharacterBase` (implements `IAbilitySystemInterface` → `GetAbilitySystemComponent()`). Enemy: `AARPGEnemyCharacter` : `AARPGCharacterBase`. Both have the ASC from the base.
- `AARPGGameMode` sets no `HUDClass`. The slice GameMode is the Blueprint `/Game/VerticalSlice/BP_VSGameMode` (parent `AARPGGameMode`) — PS-1 built it. `HUDClass` is a settable `AGameModeBase` property.
- `Source\PoF\PoF.Build.cs` already lists `UMG` (the existing `UUserWidget` classes compile) — and `FunctionalTesting` (PS-1). No new module dependency expected; Task 1 confirms.
- The PS-1 functional test runs headless: `UnrealEditor-Cmd ... /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log`.
- UE 5.7 headless asset/Python via the full editor (`UnrealEditor.exe ... -ExecutePythonScript=`) — the lightweight `-run=pythonscript` commandlet crashed on prior content tasks; a CDO-property set is lightweight but use the full-editor form if `-run=pythonscript` fails. Headless runs end with a benign shutdown crash (exit code 3) AFTER the work — judge by log content.

Shorthand: `<UE>` = `C:\Users\kazda\Documents\Unreal Projects\PoF`; `UBT` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe"`; `UE_CMD` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"`; `UE_EDITOR` = `"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe"`; `UPROJECT` = `"<UE>\PoF.uproject"`.

---

## File structure

| File | Action | Repo |
|------|--------|------|
| `<UE>/Source/PoF/UI/VSHUDWidget.h` + `.cpp` | Create | UE repo (`pof-exp`) |
| `<UE>/Source/PoF/UI/VSHUD.h` + `.cpp` | Create | UE repo (`pof-exp`) |
| `<UE>/Content/Python/wire_hud.py` | Create | UE repo (`pof-exp`) |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-hud.md` | Create | app repo |

Total: 5 source files + 1 findings doc; ~3 commits to the UE repo + 1 to the app repo.

---

## Task 1: The C++ HUD — `UVSHUDWidget` + `AVSHUD`

**Files:**
- Create: `<UE>/Source/PoF/UI/VSHUDWidget.h`, `VSHUDWidget.cpp`
- Create: `<UE>/Source/PoF/UI/VSHUD.h`, `VSHUD.cpp`

- [ ] **Step 1: Read the reference**

Read `<UE>\Source\PoF\UI\BossHealthBarWidget.h` and `.cpp` in full. It is a `UUserWidget` that builds its widget tree in C++ with no `BindWidget` — note the exact method it overrides to construct the tree (`RebuildWidget()` or similar), how it uses `WidgetTree->ConstructWidget<>()`, how it sets the root widget, and how it lays children out. `UVSHUDWidget` mirrors this idiom. Also confirm `UMG` is in `<UE>\Source\PoF\PoF.Build.cs` `PublicDependencyModuleNames` (it is — the existing widgets compile).

- [ ] **Step 2: Write `VSHUDWidget.h`**

Create `<UE>/Source/PoF/UI/VSHUDWidget.h`:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "VSHUDWidget.generated.h"

struct FOnAttributeChangeData;

/**
 * Vertical-slice combat HUD widget. Builds its own widget tree in C++ (no
 * BindWidget, no companion Widget Blueprint) — see UBossHealthBarWidget.
 * A player health bar (top-left) and a target/enemy health bar (top-centre),
 * each bound to a GAS AbilitySystemComponent's Health attribute.
 */
UCLASS()
class POF_API UVSHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Bind the player health bar to a player ASC. */
	void BindPlayer(class UAbilitySystemComponent* ASC);
	/** Bind the target health bar to an enemy ASC; label it with EnemyName. */
	void BindEnemy(class UAbilitySystemComponent* ASC, const FString& EnemyName);

protected:
	virtual void NativeConstruct() override;

private:
	void OnPlayerHealthChanged(const FOnAttributeChangeData& Data);
	void OnPlayerMaxHealthChanged(const FOnAttributeChangeData& Data);
	void OnEnemyHealthChanged(const FOnAttributeChangeData& Data);
	void OnEnemyMaxHealthChanged(const FOnAttributeChangeData& Data);
	void RefreshPlayerBar();
	void RefreshEnemyBar();

	UPROPERTY() class UProgressBar* PlayerHealthBar = nullptr;
	UPROPERTY() class UTextBlock*   PlayerHealthText = nullptr;
	UPROPERTY() class UTextBlock*   EnemyNameText = nullptr;
	UPROPERTY() class UProgressBar* EnemyHealthBar = nullptr;
	UPROPERTY() class UTextBlock*   EnemyHealthText = nullptr;

	float PlayerHealth = 0.f, PlayerMaxHealth = 1.f;
	float EnemyHealth  = 0.f, EnemyMaxHealth  = 1.f;
	TWeakObjectPtr<class UAbilitySystemComponent> PlayerASC;
	TWeakObjectPtr<class UAbilitySystemComponent> EnemyASC;
};
```

- [ ] **Step 3: Write `VSHUDWidget.cpp`**

Create `<UE>/Source/PoF/UI/VSHUDWidget.cpp`. The contract:
- Includes: `VSHUDWidget.h`, `AbilitySystemComponent.h`, `AbilitySystem/ARPGAttributeSet.h`, `Blueprint/WidgetTree.h`, `Components/CanvasPanel.h`, `Components/CanvasPanelSlot.h`, `Components/ProgressBar.h`, `Components/TextBlock.h`.
- **Tree construction** — build the tree the same way `UBossHealthBarWidget` does (mirror its overridden method; do NOT use `BindWidget`). Construct a `UCanvasPanel` as the root via `WidgetTree->ConstructWidget<UCanvasPanel>()` and `WidgetTree->RootWidget = ...`. Construct the five widgets (`PlayerHealthBar`, `PlayerHealthText`, `EnemyNameText`, `EnemyHealthBar`, `EnemyHealthText`) with `WidgetTree->ConstructWidget<>()`, add each to the canvas (`Cast<UCanvasPanelSlot>(Canvas->AddChildToCanvas(W))`), and lay them out: the player block anchored top-left (e.g. position ~(40,40), bar size ~(260,22)); the target block anchored top-centre (anchor 0.5,0; aligned centre; name text above a ~(360,20) bar). Give the bars distinct fill colours (player green-ish, enemy red-ish) via `UProgressBar::SetFillColorAndOpacity`.
- `NativeConstruct()` — call `Super`, then ensure the tree is built (if the mirrored idiom builds on `RebuildWidget`/construct, nothing more is needed here; otherwise build here). Set initial bar percents to 1.0 and placeholder text.
- `BindPlayer(ASC)` — store `PlayerASC`; seed `PlayerHealth`/`PlayerMaxHealth` from `ASC->GetNumericAttribute(UARPGAttributeSet::GetHealthAttribute())` and `GetMaxHealthAttribute()`; register `ASC->GetGameplayAttributeValueChangeDelegate(UARPGAttributeSet::GetHealthAttribute()).AddUObject(this, &UVSHUDWidget::OnPlayerHealthChanged)` and the MaxHealth equivalent; call `RefreshPlayerBar()`.
- `BindEnemy(ASC, EnemyName)` — same for the enemy attributes/handlers; set `EnemyNameText` to `EnemyName`; call `RefreshEnemyBar()`.
- `OnPlayer*Changed` / `OnEnemy*Changed` — update the cached float from `Data.NewValue`, call the matching `Refresh*Bar()`.
- `RefreshPlayerBar()` — `PlayerHealthBar->SetPercent(PlayerMaxHealth > 0 ? PlayerHealth/PlayerMaxHealth : 0)`; `PlayerHealthText->SetText(FText::FromString(FString::Printf(TEXT("%.0f / %.0f"), PlayerHealth, PlayerMaxHealth)))`. `RefreshEnemyBar()` — likewise for the enemy widgets.

Keep it close to `UBossHealthBarWidget`'s style. The exact `UCanvasPanelSlot` setters (`SetAnchors`, `SetPosition`, `SetSize`, `SetAlignment`, `SetAutoSize`) and the tree-build method name are taken from the reference read in Step 1 — use the real API, do not guess.

- [ ] **Step 4: Write `VSHUD.h`**

Create `<UE>/Source/PoF/UI/VSHUD.h`:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "VSHUD.generated.h"

/** Minimal AHUD for the vertical slice: spawns the UVSHUDWidget and binds it
 *  to the player and the (single) enemy. Set as HUDClass on BP_VSGameMode. */
UCLASS()
class POF_API AVSHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;

private:
	void TryBind();

	UPROPERTY() class UVSHUDWidget* HUDWidget = nullptr;
	int32 BindAttempts = 0;
	FTimerHandle BindTimerHandle;
};
```

- [ ] **Step 5: Write `VSHUD.cpp`**

Create `<UE>/Source/PoF/UI/VSHUD.cpp`. The contract:
- Includes: `VSHUD.h`, `VSHUDWidget.h`, `Player/ARPGPlayerCharacter.h`, `Character/ARPGEnemyCharacter.h`, `AbilitySystemInterface.h`, `AbilitySystemComponent.h`, `Blueprint/UserWidget.h`, `EngineUtils.h`, `Kismet/GameplayStatics.h`, `TimerManager.h`.
- `BeginPlay()` — call `Super`; `HUDWidget = CreateWidget<UVSHUDWidget>(GetWorld(), UVSHUDWidget::StaticClass())`; if valid, `HUDWidget->AddToViewport()`; then `TryBind()`.
- `TryBind()` — resolve the player: `UGameplayStatics::GetPlayerPawn(this,0)`, cast through `IAbilitySystemInterface` (or `AARPGCharacterBase::GetAbilitySystemComponent()`) to a `UAbilitySystemComponent*`; resolve the enemy: `for (TActorIterator<AARPGEnemyCharacter> It(GetWorld()); It; ++It)` take the first, get its ASC. If `HUDWidget` and the player ASC and the enemy ASC are all valid → `HUDWidget->BindPlayer(playerASC)` and `HUDWidget->BindEnemy(enemyASC, enemy->GetActorLabel())` (or a fixed `TEXT("Enemy")`), then stop. If not all resolved and `BindAttempts < 10`, `++BindAttempts` and `GetWorldTimerManager().SetTimer(BindTimerHandle, this, &AVSHUD::TryBind, 0.5f, false)` to retry; after 10 attempts, `UE_LOG` a warning and bind whatever is available.
- Add a `UE_LOG(LogTemp, Log, TEXT("[VSHUD] HUD created / bound..."))` line in `BeginPlay`/`TryBind` so a headless run can confirm the HUD actor ran.

- [ ] **Step 6: Build the editor target**

```bash
"<UBT>" PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```
Expected: `Result: Succeeded`. Fix compile errors — most likely a missing include, a wrong `UCanvasPanelSlot` setter name, or the tree-build method name (cross-check the reference). Rebuild until clean.

- [ ] **Step 7: Commit to the UE repo**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Source/PoF/UI/VSHUDWidget.h Source/PoF/UI/VSHUDWidget.cpp Source/PoF/UI/VSHUD.h Source/PoF/UI/VSHUD.cpp
git commit -m "$(cat <<'EOF'
feat(hud): pure-C++ vertical-slice HUD — UVSHUDWidget + AVSHUD

UVSHUDWidget builds its widget tree in C++ (UBossHealthBarWidget pattern, no
BindWidget): a player health bar + a target/enemy health bar, each bound to a
GAS AbilitySystemComponent's Health attribute. AVSHUD creates it, adds it to
the viewport, and binds the player + enemy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: Wire `HUDClass` on the GameMode

**Files:**
- Create: `<UE>/Content/Python/wire_hud.py`

- [ ] **Step 1: Write the wiring script**

Create `<UE>/Content/Python/wire_hud.py`. Using the `unreal` module it must:
- Load the Blueprint `/Game/VerticalSlice/BP_VSGameMode`.
- Get its generated class's CDO (`unreal.get_default_object(bp.generated_class())`).
- Set the CDO's `HUDClass` editor property to the `AVSHUD` class. Resolve the `AVSHUD` class via `unreal.load_class(None, '/Script/PoF.VSHUD')` (UCLASS `AVSHUD` → script name `VSHUD`).
- Save the Blueprint asset (`unreal.EditorAssetLibrary.save_asset('/Game/VerticalSlice/BP_VSGameMode')`).
- Log each step with `unreal.log` and a final `=== HUD wiring COMPLETE ===`; wrap in try/except that `unreal.log_error`s and re-raises.

- [ ] **Step 2: Run the wiring script headless**

```bash
"<UE_CMD>" "<UPROJECT>" -run=pythonscript -script="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\wire_hud.py" -unattended -nopause 2>&1
```
Expected: log shows `HUD wiring COMPLETE` and `BP_VSGameMode` saved. If `-run=pythonscript` crashes, re-run via `"<UE_EDITOR>" "<UPROJECT>" -ExecutePythonScript="C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\wire_hud.py" -unattended` (kill the editor after the script logs COMPLETE). Judge success by the log, not the exit code.

- [ ] **Step 3: Commit to the UE repo**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/wire_hud.py
git commit -m "$(cat <<'EOF'
feat(hud): wire AVSHUD as HUDClass on BP_VSGameMode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Verify + findings

**Files:**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-hud.md` (app repo)

- [ ] **Step 1: Re-run the PS-1 functional test**

```bash
"<UE_CMD>" "<UPROJECT>" /Game/Maps/VerticalSlice -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -log 2>&1
```
Expected: all four criteria (#2–#5) report pass, run Success. The HUD cannot affect gameplay; this confirms nothing was disturbed. (Judge by the automation log's `Assertion passed` lines + `Result={Success}`, not the process exit code. `-nullrhi` will not render the HUD — expected.)

- [ ] **Step 2: Launch the slice and capture a screenshot**

Launch in a real (rendered) window so the HUD draws:
```bash
"<UE_EDITOR>" "<UPROJECT>" /Game/Maps/VerticalSlice -game -windowed -ResX=1280 -ResY=720 -ExecCmds="HighResShot 1280x720" 2>&1
```
(If `HighResShot` via `-ExecCmds` does not flush a file, let the game run ~20–25 s then take the shot; screenshots land in `<UE>\Saved\Screenshots\`. Pick the newest.) Also check `<UE>\Saved\Logs\PoF.log` for the `[VSHUD]` log line — confirms the HUD actor spawned.

- [ ] **Step 3: Gemini check the HUD**

```bash
cd C:/Users/kazda/kiro/personas
export $(grep -E '^(GEMINI_API_KEY)=' .env | xargs)
node .claude/skills/leonardo/tools/gemini-recognize.mjs --input "<screenshot path>" --prompt "Look at this game screenshot. Is there a health bar UI element in the top-left corner? Is there a second health bar near the top-centre? Describe any on-screen HUD elements (bars, text). Do they look like a combat HUD overlaid on the 3D scene?"
cd C:/Users/kazda/kiro/pof
```
Record the description. The HUD gate: Gemini confirms a player health bar (top-left) and a target/enemy health bar (top-centre) are visible on screen. If the HUD does not appear, diagnose: check the `[VSHUD]` log line (did the HUD actor spawn? — if not, `HUDClass` did not take effect, re-check Task 2), and whether `CreateWidget`/`AddToViewport` ran. Fix in `VSHUD.cpp`/`VSHUDWidget.cpp` (rebuild) or `wire_hud.py` (re-run), then re-do Steps 2–3.

- [ ] **Step 4: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-hud.md` recording: the HUD built (player bar + enemy bar, pure C++, no UMG editor), the functional-test result (#2–#5), the Gemini description of the on-screen HUD, any fix made in the Step 3 loop, and a note on remaining initiative work (the deferred real-character sub-project).

- [ ] **Step 5: Commit + final summary**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-hud.md
git commit -m "$(cat <<'EOF'
docs(features): HUD sub-project findings — vertical-slice combat HUD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Then post a chat summary: the HUD outcome (player + enemy health bars, pure C++), the functional-test result, the Gemini confirmation, and that the only remaining initiative item is the deferred real-character sub-project.

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec `UVSHUDWidget` → Task 1 Steps 2–3; `AVSHUD` → Task 1 Steps 4–5; the build → Task 1 Step 6; `HUDClass` wiring (UE Python) → Task 2; verification (functional test + Gemini screenshot) → Task 3. Spec DoD 1–6 map (1→T1, 2→T2, 3→T3 Steps 2–3, 4→T3 Step 1, 5→T3 Step 4, 6→all commits).
- [x] **Placeholder scan:** Task 1's two headers are given complete; the two `.cpp` files are given as a concrete contract (includes, methods, behaviour, the exact GAS-bind APIs) with "mirror `UBossHealthBarWidget`" for the one engine-version-specific idiom (the widget-tree build method) — the reference is read first in Step 1. This is deliberate, not vague: UMG C++ tree-construction has known API-shape variation best resolved against the in-project working example. No "TBD"/"handle errors".
- [x] **Type consistency:** `UVSHUDWidget` members (`PlayerHealthBar`, `EnemyHealthBar`, `EnemyNameText`, …) and methods (`BindPlayer(ASC)`, `BindEnemy(ASC, name)`) defined in the header (Step 2) and used by the `.cpp` (Step 3) and by `AVSHUD::TryBind` (Step 5). `AVSHUD` is the class `wire_hud.py` sets as `HUDClass` (Task 2) — script name `/Script/PoF.VSHUD`. The functional-test path and `BP_VSGameMode` path match PS-1.
- [x] **UE repo vs app repo:** the 5 source files commit to the UE repo (`pof-exp`, commits run with `cd` into the UE project); the findings doc to the app repo. Explicit per task.
- [x] **Bite-sized:** T1=7, T2=3, T3=5 steps; each a single action.
