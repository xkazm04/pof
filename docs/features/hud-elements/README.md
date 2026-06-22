# HUD Elements Pipeline

> Catalog ID `hud-elements` · Category UI · `ui-hud` module · 10 steps · Tracks: logic, art-2d, animation, vfx, audio, test

**Purpose.** Authors persistent in-game UMG widgets that surface live game-state to the player. The reference entity is the Health Bar — a widget that binds to `UARPGAttributeSet.Health / MaxHealth` via the `OnAttributeChanged` delegate, renders `{cur}/{max}`, and is anchored bottom-left. Wiring: `AARPGHUD::BeginPlay` creates `WBP_<slug>` and adds it to the viewport; `UARPGAttributeSet::PostAttributeChange` fires `OnHealthChanged`, which refreshes the progress-bar value and format string (never hard-coded placement, per canon `proj-hud-binding`).

## Target / starter entity
- **Health Bar** (`hud-health-bar`, Vitals) — the player health bar widget.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Data Binding | schema | `WBP_HudHealthBar`, `DT_HUDElements` | L0 + L2 · `fieldsPopulated(source/format/anchor)`; `cppSymbolExists` `UARPGAttributeSet`, `AARPGHUD` |
| 3 | State Logic | rules | — | L0 · `fieldsPopulated(states/transitions/lowHealthThreshold)` |
| 4 | Wireframe | gallery | `T_<slug>_WF_Standard/_LowHealth/_WithShield` | L1 · `selected` |
| 5 | Icon 2D Art | gallery | `T_<slug>_Icon_Heart/_Shield/_Skull/_Regen` | L1 · `selected` |
| 6 | Animation | checklist | — | L0 · `minCount(animChecks, ≥4)` |
| 7 | Accessibility | checklist | — | L0 · `minCount(a11yChecks, ≥4)` (art-icon-a11y) |
| 8 | Localization | checklist | — | L0 · `minCount(l10nChecks, ≥3)` |
| 9 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSHUDElementTest)` |
| 10 | UE Packaging | manifest | `WBP_<slug>`, `DT_HUDElements::<slug>`, `T_<slug>_Fill_*`, `T_<slug>_ShieldOverlay` | L0 + L2 · `minCount(assets, ≥2)`; `cppSymbolExists` ×2 + `seedRowPresent(seed_hud_elements.py)` |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGAttributeSet` (Health/MaxHealth/EnergyShield attributes), `AARPGHUD` (HUD class that creates and owns the widget), `UARPGAbilitySystemComponent` (attribute source).
- **DataTables / assets:** `DT_HUDElements`, `WBP_HudHealthBar`, fill/overlay textures (`T_<slug>_Fill_Full/Low/Critical`, `T_<slug>_ShieldOverlay`).
- **Seed script** (`seedRowPresent`): `seed_hud_elements.py` seeds the WBP row in `DT_HUDElements`.
- **Runtime test:** `VSHUDElementTest` (renders + binds at 1080p/4K in PIE).
- **Cross-catalog links:** `icon-sets::iconset-abilities` (vitals icon, role `vitals-icon`). Shield layer maps to ARPG-LAWS §8 defense-layer model.

## Acceptance profile
Uses **L0 (data)** for brief/state/animation/a11y/localization steps, **L1 (human selection)** for wireframe + icon galleries, **L2 (static UE source)** on Data Binding and UE Packaging (`cppSymbolExists` + `seedRowPresent`), and one **L3 runtime-deferred** gate (`VSHUDElementTest`). Config-complete here means every data/static step passes and the runtime render test sits `deferred` with a reason until a UE bridge runs.

## Status & notes
Ten-step UI pipeline. The Icon 2D Art step doubles as the universal Icon step (AUTHORING §3). Restrained-by-design: animations fire only on state transitions, low-health (≤25%) and critical (≤10%) thresholds add brightness/pattern cues so meaning is never hue-only (colorblind-safe). Note: shield overlay is descriptive when `EnergyShield`/`Ward` is unavailable.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
