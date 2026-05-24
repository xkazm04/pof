# 04 · HUD / UI — Test Coverage

## What we have

- The HUD sub-project's verification: re-run PS-1 functional test + a
  Gemini-vision check on a real-launch screenshot. This caught the
  `RebuildWidget`-timing bug, the empty-`UProgressBar` invisibility, and
  (later) the Constant3Vector pin-name material bug.
- No dedicated UMG unit tests in the project yet.

## Tests to add — UE side (`AFunctionalTest`s)

1. **`AVSHUDPresenceTest`** — spawns the HUD in PIE, asserts via
   `GEngine->GameViewport->GetGameViewportClient()->FindWidgets(...)` (or
   equivalent) that exactly one `UVSHUDWidget` (or its successor) is in
   the viewport. Detects "the HUD actor didn't spawn" without needing
   Gemini.
2. **`AVSHUDBarBindingTest`** — calls `BindPlayer(ASC)`/`BindEnemy(ASC)`
   with a known ASC; manually applies a `GE_Damage` that drops Health by
   20; asserts `PlayerHealthBar->Percent` (or the equivalent) updated to
   0.8 within one tick. Detects regressions in the GAS delegate plumbing.
3. **`AVSHUDTreeStructureTest`** — constructs the widget; walks the
   `WidgetTree` and asserts it has a root `UCanvasPanel` with the
   expected named children (`PlayerHealthBar`, `EnemyHealthBar`,
   `EnemyNameText`, ...). Detects the `NativeConstruct`-vs-`RebuildWidget`
   regression — an empty tree fails immediately.
4. **`AVSHUDDamageNumberTest`** — after [[game.md]] §2 lands, applies a
   damage GE to the enemy; asserts the world contains at least one
   `UDamageNumberWidget` actor for ~1 s. Verifies the existing wired but
   unused damage-numbers system.

## Tests to add — PoF app side

1. **Pure-C++-widget-template prompt test** — vitest snapshots the
   `arpg-ui` checklist's widget-generation prompt; asserts it emits
   `UARPGCodeWidgetBase` as the parent class by default, forbids
   `BindWidget`, and includes the `RebuildWidget`-timing reminder.
2. **`wiringAssets` UMG-WBP coverage test** — asserts every BindWidget-
   coupled class in the project (the `UARPGHUDWidget` family) has its
   required WBP listed in `wiringAssets`. Until a WBP is provided, the
   matrix shows red.
3. **`screenshot-and-describe` step injection test** — asserts every
   dispatch routed through the `arpg-ui` module ends with a
   screenshot-and-Gemini-describe step. Codifies the verification pattern
   the HUD sub-project proved.

## E2E harness extensions

1. **`hud-from-scratch.spec.ts`** in `e2e/` — on a fresh UE project,
   dispatch `arpg-ui` with a "create a player health bar" prompt, build,
   launch, take a screenshot, Gemini-confirm the bar is visible at the
   expected screen position. End-to-end success criterion for a new HUD
   element via PoF.
2. **`gemini-recognize.mjs` HUD-prompt fixture** at
   `e2e/fixtures/gemini-prompts/hud-check.txt` — stable, comparable prompt
   across runs (same pattern as character-check). Asks Gemini explicitly
   "name each on-screen UI element and its position; do any read as
   empty/zero-width?" The wording is load-bearing — the HUD sub-project
   needed a sharper prompt than the first attempt to detect the empty
   bar.

## Implementation status (2026-05-24)

- The four specced UE HUD tests (1-4) are covered by the existing consolidated
  `AVSHUDFunctionalTest` (phases HUDStructure → HUDBinding → DamageNumbers).
- Added `Source/PoF/Test/HUD/ARPGHUDWidgetTest` for the **reparented real HUD**
  (phases HUDStructure → Hotbar → HitVignette → HUDBinding) — asserts the
  code-built widget tree (HealthBar/ManaBar/StaminaBar/XPBar/LevelText/
  HitVignette), that the hotbar produces slot widgets, that the §4 vignette's
  render-opacity rises after player damage, and that the player bar tracks GAS
  health. **Uncommitted pending the operator's build** (shared monolithic build).
- App-side prompt/wiring tests, the `hud-check.txt` Gemini fixture, and the e2e
  `hud-from-scratch.spec.ts` were shipped earlier; the `arpg-ui` prompt test now
  also asserts the prompts name `UARPGCodeWidgetBase`.

## Lessons that motivate each test

- **The `RebuildWidget` timing bug rendered an empty widget.** The tree-
  structure test fails immediately for that class of regression, no
  screenshot needed.
- **An empty `UProgressBar` is invisible.** The styled-bar helper in
  `UARPGCodeWidgetBase` ([[game.md]] §1) is the fix; the bar-binding test
  asserts a measurable percent change — a still-invisible bar with the
  binding broken would also fail this test.
- **Gemini caught the bug only after the HUD was already running.** The
  presence + tree-structure + binding tests catch the failure earlier,
  cheaper, deterministically.
- **`MI_Manny_02` was too subtle** — the Gemini HUD-prompt fixture
  forces a discriminating prompt so "is the bar visible / different /
  empty?" is a hard yes/no, not a paragraph.

## What this folder does *not* test

Gameplay logic that *causes* HUD changes (damage application, ability
activation, character death) — those are covered in folders 03 and 02. The
HUD tests here verify the UI surfaces the state correctly *given* the
state changes.
