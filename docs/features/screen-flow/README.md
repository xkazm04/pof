# Screen Flow Pipeline

> Catalog ID `screen-flow` · Category Core / Existing · 11 steps

**Purpose.** Represents the UI navigation graph between screens/menus in the PoF ARPG: how the player moves MainMenu → InGame HUD, through overlays (Inventory, CharStats, Pause) and back to terminal states (QuitToDesktop, InGame). The pipeline documents the full navigation graph plus input bindings, widget composition, transitions, VFX/SFX juice, accessibility, localization, and UE packaging for one Flow entity. Wiring: `UARPGHUDContext` (owned by `AARPGHUD`) drives screen-stack push/pop; `WBP_` UserWidgets are pushed to the viewport; `UARPGInputModeComponent` switches Game/UI/GameAndUI input modes on open/close via Enhanced Input actions.

## Target / starter entity
- **Main Menu Flow** (`screen-HUD` / a real seeded screen entity from `FLOW_NODES`) — the navigation state machine rooted at the main menu, embedding the HUD vitals bar when in combat.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Navigation Graph | graph | — | L0 · `graphValid(graph)` — 13 nodes / 22 edges, terminals QUIT_TO_DESKTOP + IN_GAME |
| 3 | Input Mapping | rules | `IMC_Navigation` | L0 · `minCount(inputMapping, 1)` |
| 4 | Component Inventory | rules | `WBP_MainMenu/InGameHUD/InventoryOverlay/CharStatsOverlay/PauseMenu/DeathScreen/SettingsPanel` | L0 · `minCount(componentInventory, 1)` |
| 5 | Transitions / Animation | checklist | — | L0 · `minCount(transitionChecks, 1)` |
| 6 | VFX / SFX Juice | rules | `SC_UI_*`, `SC_Death_Sting`, `SC_Respawn_Ambient` | L0 · `minCount(juiceRules, 1)` |
| 7 | Accessibility | checklist | — | L0 · `minCount(a11yChecks, 1)` |
| 8 | Localization | checklist | — | L0 · `minCount(locChecks, 1)` |
| 9 | Icon 2D Art | gallery | `T_<slug>_ScreenFlowIcon` | L1 · `selected` |
| 10 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSScreenFlowTest)` |
| 11 | UE Packaging | manifest | `WBP_*` (8 widgets), `T_<slug>_ScreenFlowIcon`, `IMC_Navigation` | L0 · `minCount(assets, 3)` |

## UE wiring
- **C++ classes** (named in wiring contracts; this pipeline has no `cppSymbolExists` static check): `AARPGHUD` (owns root widget + screen stack), `UARPGHUDContext` (push/pop/replace), `UARPGInputModeComponent` (Game/UI input modes, on `AARPGPlayerController`), `AARPGCharacter::OnDeath` → `ShowDeathScreen`.
- **Assets:** `WBP_MainMenu`, `WBP_InGameHUD`, `WBP_InventoryOverlay`, `WBP_CharStatsOverlay`, `WBP_PauseMenu`, `WBP_DeathScreen`, `WBP_SettingsPanel`, `WBP_QuitConfirmDialog`; `IMC_Navigation` mapping context (IA_OpenInventory/OpenCharStats/Pause/Confirm/Back); UI SoundCues. Widget classes set in ProjectSettings → ARPG → HUDWidgetClasses (never C++ hardcode).
- **Runtime test:** `VSScreenFlowTest` (all 13 screens reachable from main_menu, back-stack correct, z-order + InputMode correct in PIE).
- **Cross-catalog links:** `hud-elements::hud-health-bar` (embedded vitals bar in InGame HUD), `icon-sets::iconset-abilities` (screen-icon family), `input-schemes` (Enhanced Input actions — declared as a dependency).

## Acceptance profile
This pipeline is **entirely config-time**: **L0 (data)** for every authoring step, with the Navigation Graph using the `graphValid` checker (reachability + ≥1 terminal), **L1 (human selection)** for the icon gallery, and one **L3 runtime-deferred** gate (`VSScreenFlowTest`). No `cppSymbolExists`/`seedRowPresent` static checks. Config-complete = all L0/L1 steps pass and the navigation-walk test sits `deferred` until a live-UE/PIE runner executes it.

## Status & notes
Uses the **`graph` archetype** heavily — the Navigation Graph is the key step (13 nodes, 22 edges; terminals QUIT_TO_DESKTOP and IN_GAME; overlay z-depths HUD=1 / FloatingBars=2 / Overlays=3 / Modals=4). Design intent is keyboard/controller-first with zero mouse-only paths; every transition is a named Enhanced Input Action so remapping never silently breaks navigation. UI VFX is pure UMG WidgetAnimation + PostProcess params — no Niagara emitters in UI (canon vfx-budget). Localization keys follow `UI_<SCREEN>_<ELEMENT>` with a German ~135%-expansion overflow guard.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
