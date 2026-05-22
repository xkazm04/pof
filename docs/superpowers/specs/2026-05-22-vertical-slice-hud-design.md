---
date: 2026-05-22
status: draft
sub_project: HUD (vertical-slice combat HUD)
parent_initiative: PoF ARPG vertical slice
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-3-textures.md
  - docs/superpowers/specs/2026-05-22-playable-slice-ps-3-design.md
---

# Sub-project: Vertical-slice combat HUD

## Context

The Playable Slice phase (PS-1 → PS-3) produced a verified, playable, textured
ARPG vertical slice — but it has **no visible HUD**. A HUD inventory
(2026-05-22) established:

- The project has a real HUD codebase — `AARPGHUD` (an `AHUD`),
  `UARPGHUDWidget` / `UARPGMainHUDWidget` (`UUserWidget`s with full GAS-binding
  logic) — but it is **dead code**: no GameMode sets `HUDClass`, so the HUD
  actor never spawns.
- Those `UUserWidget` classes use `UPROPERTY(meta=(BindWidget))` — they each
  *require* a companion UMG **Widget Blueprint** with exactly-named child
  widgets, and **UE Python cannot author UMG widget trees**. That path needs
  the UMG editor (manual).
- **The escape hatch:** the project's own `UBossHealthBarWidget` has **zero
  `BindWidget`** — it builds its entire widget tree programmatically in C++
  via `WidgetTree->ConstructWidget<>()`. No Widget Blueprint, no UMG editor.
  This is the proven in-project pattern for a fully-code HUD.
- Health flows through the GAS `UARPGAttributeSet`; the ASC's
  `GetGameplayAttributeValueChangeDelegate` fires on every attribute change —
  a health bar binds to that.

This sub-project gives the slice a HUD, built entirely in C++.

## Goals

1. A visible player health bar on screen during the slice.
2. A visible target/enemy health bar that reflects the enemy's live health —
   so the slice's combat (the enemy's health dropping as it is attacked) is
   on-screen.
3. Built with **no UMG editor and no binary widget assets** — pure C++.
4. The slice still plays — the PS-1 functional test stays green.

## Non-goals

- **No mana / stamina / XP / ability bars / minimap.** Just the two health
  bars — the slice has no mana cost, no XP flow shown, one ability.
- **No use of the existing `ARPGHUDWidget` / `ARPGMainHUDWidget`.** They are
  `BindWidget`-coupled and need a hand-built Widget Blueprint. They remain the
  project's "real" HUD for a future UMG-editor pass; this sub-project does not
  touch or revive them.
- **No UMG Widget Blueprint assets** — none are created (Python cannot author
  them; the UMG editor is out of scope).
- **No gameplay change, no PoF app source change.** UE project C++ + one UE
  Python wiring script only.

## Decision record (from brainstorming)

1. **HUD = both bars** — a player health bar and an enemy/target health bar
   (chosen over player-only and enemy-only). In this slice the player takes no
   damage, so the player bar is static; the enemy bar carries the live combat
   feedback.
2. **A1 — one screen-space widget holds both bars** (chosen over A2, a
   world-space `UWidgetComponent` enemy bar). The slice has exactly one enemy;
   a single screen-space widget with player health top-left and target health
   top-centre is simplest and conventional.
3. **Pure-C++ widgets** — the `UBossHealthBarWidget` pattern; no Widget
   Blueprints.

## Design

### `UVSHUDWidget : UUserWidget` (new)

A pure-C++ HUD widget. It builds its own widget tree in C++ — no `BindWidget`,
no companion Widget Blueprint — following `UBossHealthBarWidget`'s pattern
(`WidgetTree->ConstructWidget<>()`, `CanvasPanelSlot` layout).

- Widget tree: a root `UCanvasPanel` containing
  - **player block** (top-left): a `UProgressBar` (`PlayerHealthBar`) + a
    `UTextBlock` (`PlayerHealthText`, "current / max"),
  - **target block** (top-centre): a `UTextBlock` (`EnemyNameText`) + a
    `UProgressBar` (`EnemyHealthBar`) + a `UTextBlock` (`EnemyHealthText`).
- `BindPlayer(UAbilitySystemComponent* ASC)` — registers an
  `AddUObject` callback on
  `ASC->GetGameplayAttributeValueChangeDelegate(UARPGAttributeSet::GetHealthAttribute())`
  (and `MaxHealth`); seeds the bar from the current value; updates
  `PlayerHealthBar`'s percent and `PlayerHealthText` on change.
- `BindEnemy(UAbilitySystemComponent* ASC)` — the same for the enemy's
  `Health`/`MaxHealth`, driving `EnemyHealthBar` / `EnemyHealthText`.
- A `NativeTick` may smooth the bar toward its target (optional polish; a
  direct set is acceptable for the slice).

### `AVSHUD : AHUD` (new)

A minimal HUD actor. On `BeginPlay`:
- Create the `UVSHUDWidget` (`CreateWidget`), `AddToViewport`.
- Resolve the player: `GetOwningPawn()` / the player pawn → cast to
  `AARPGPlayerCharacter` → its `UAbilitySystemComponent` → `BindPlayer`.
- Resolve the enemy: iterate the world for an `AARPGEnemyCharacter` → its ASC
  → `BindEnemy`. (One enemy in the slice; bind the first found.)
- If either is not found yet (timing), retry briefly via a short timer — the
  HUD spawns early in `BeginPlay`; the enemy may not be possessed yet.

`AVSHUD` does **not** reuse `AARPGHUD` (whose `BeginPlay` creates the whole
`BindWidget` widget family). It is a fresh, minimal `AHUD`.

### Wiring — UE Python

A small UE Python script sets `HUDClass` on `BP_VSGameMode` (the slice's
GameMode, built in PS-1) to `AVSHUD`. UE then spawns the HUD actor
automatically for every player. (Same pattern as PS-1's GameMode wiring.)

### Verification

- **Gameplay intact:** re-run the PS-1 functional test
  (`Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`) — #2–#5
  still green. The HUD cannot affect gameplay; the re-run confirms nothing was
  disturbed. (The test runs `-nullrhi` — it will not *render* the HUD; that is
  expected, the test asserts game state.)
- **HUD visible (the real gate):** launch the slice in a real (non-headless)
  game window, capture a screenshot, and check with Gemini vision that a
  player health bar and a target/enemy health bar are on screen. Because the
  functional test drives the enemy's Health 100 → 0, a screenshot taken
  mid-combat (or a second one) should show the enemy bar partly depleted —
  evidence the bar tracks live health.

## Verification (of this sub-project)

Passes when: `UVSHUDWidget` + `AVSHUD` compile and are wired via `HUDClass` on
`BP_VSGameMode`; a real game launch shows a player health bar and an enemy
health bar (Gemini-confirmed); and the PS-1 functional test re-runs green.

## Cross-cutting

- **Branch / repos:** the UE project is a git repo (`github.com/xkazm04/pof-exp`)
  — the new C++ + the Python script commit there. The spec, plan, and findings
  doc commit to the PoF app repo.
- **New C++ in the UE project** → a UE editor rebuild (fast, proven). The
  `PoF.Build.cs` already depends on `UMG` (the existing widgets compile), so no
  new module dependency is expected — confirmed at plan time.
- **Controller-driven** — Claude authors the C++ and the Python; the harness
  builds and runs. No PoF dev server.
- Commit locally; the UE repo can be pushed to `pof-exp`.

## Definition of done

1. `UVSHUDWidget` and `AVSHUD` C++ classes created; the UE editor target
   builds clean.
2. `HUDClass` on `BP_VSGameMode` set to `AVSHUD` via a UE Python script.
3. A real game launch shows a player health bar and an enemy health bar
   (Gemini-confirmed).
4. The PS-1 functional test re-runs green (#2–#5).
5. A findings doc records the outcome under
   `docs/features/arpg-vertical-slice/scenario-runs/`.
6. C++ + script committed to the UE repo; spec/plan/findings to the app repo;
   chat summary.

**Success criterion:** the vertical slice shows a working combat HUD — a
player health bar and a live enemy health bar — built entirely in C++ with no
UMG editor, and the gameplay loop remains provably intact.

## Risks & mitigations

- **Pure-C++ UMG tree construction is fiddly** — `WidgetTree->ConstructWidget`,
  `UCanvasPanelSlot` anchors/offsets, font/brush setup. Mitigation: mirror
  `UBossHealthBarWidget` (same project, same engine) closely — it is the
  working reference; plan Task 1 reads it first.
- **HUD spawn vs. actor-init timing** — `AVSHUD::BeginPlay` may run before the
  player/enemy ASCs are ready. Mitigation: a short retry timer for the binds;
  the bind also seeds from the current attribute value, so a late bind still
  shows correct health.
- **The functional test won't render the HUD** (`-nullrhi`). Mitigation: the
  HUD's visual proof is the real-launch Gemini screenshot; the functional test
  only guards that gameplay is intact — this split is by design.
- **`AHUD` / `HUDClass` resolution** — if `HUDClass` on `BP_VSGameMode` does
  not take effect, no HUD spawns. Mitigation: plan verifies the HUD actor
  exists at runtime (a log line in `AVSHUD::BeginPlay`); the Gemini check is
  the backstop.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: C++ widgets → wiring → verify.
5. HUD complete → the remaining initiative item is the deferred
   real-character sub-project.
