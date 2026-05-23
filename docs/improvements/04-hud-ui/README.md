# 04 · HUD / UI

## Scope

The on-screen HUD, UMG widgets, in-game menus / dialogs / inventory screens
— anything the player reads or interacts with that's not the 3D world. Both
the small slice-grade overlay and the path to a full game-grade HUD.

## Current state

After the HUD sub-project (2026-05-22):

- A pure-C++ `UVSHUDWidget` (built via `WidgetTree->ConstructWidget` in
  `RebuildWidget`) draws a player health bar (top-left) and a target/enemy
  health bar (top-centre, labelled "Enemy"). Wired through `AVSHUD`, an
  `AHUD` set as `BP_VSGameMode::HUDClass`. Both bars bind to GAS attribute
  delegates on their respective ASCs.
- This sidesteps the project's "real" HUD widgets (`UARPGHUDWidget`,
  `UARPGMainHUDWidget`, `UAbilityBarWidget`, `UAbilitySlotWidget`,
  `UEnemyHealthBarWidget`, `UCharacterStatsWidget`) — all of which are
  `BindWidget`-coupled and **require** companion UMG Widget Blueprints
  that do not exist in the project and cannot be authored from Python.
- `UBossHealthBarWidget` is the other pure-C++ widget in the project, and
  was the architectural reference for `UVSHUDWidget`.
- Engine `AddOnScreenDebugMessage` debug text (HP / MP / Stamina / Lv) is
  printed in `#if !UE_BUILD_SHIPPING` from `ARPGCharacterBase` / `Player`
  ticks — it overlaps the corner where the player bar sits.

## Key lessons

1. **`BindWidget` is the wall.** A `UUserWidget` with `BindWidget`
   properties *requires* a companion WBP with exactly-named child widgets.
   Python cannot author UMG widget trees (`unreal.WidgetBlueprintFactory`
   creates an empty shell; the design-time tree + Canvas-Panel slot
   layout + `BindWidget` name resolution are not Python-accessible). The
   only fully-autonomous path is pure-C++ widgets like
   `UBossHealthBarWidget` / `UVSHUDWidget`.
2. **`UUserWidget` builds the Slate tree in `RebuildWidget()`, not
   `NativeConstruct()`.** Assignments to `WidgetTree->RootWidget` in
   `NativeConstruct` have no effect — the HUD bug was an empty widget.
3. **An empty `UProgressBar` is invisible** unless an explicit
   `FProgressBarStyle` with a dark track + bright fill is set. The default
   "background image" is transparent.
4. **Engine debug text always draws on top** and pins to the corner. It
   collides with anything you place top-left; either disable it
   (`DisableAllScreenMessages` console var) or place around it.
5. **Material connection has a subtle pin-name pitfall** —
   `MaterialExpressionConstant3Vector`'s output pin is `""`, not `"RGB"`
   (Characters fix). Relevant when generating UI materials from Python.

## Isolated-CLI session focus

A session works on:
- **UE project:** `Source/PoF/UI/`, `Content/UI/` (probably empty —
  will be created), and (for the AHUD pattern) `Source/PoF/Framework/`.
- **PoF app:** `src/components/modules/core-engine/arpg-ui/`,
  `src/lib/module-registry.ts` (the `arpg-ui` entry), the UI section of
  the evaluator prompts.

It does *not* touch character mesh/AI (folder 02), gameplay abilities
(folder 03), level (folder 05), or packaging (folder 07).
