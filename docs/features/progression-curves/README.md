# Progression Curves Pipeline

> Catalog ID `progression-curves` · Category Systems · `arpg-progression` module · 12 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** Authors the canonical Hero Level XP-to-level curve (per ARPG-LAWS §9 / canon `arpg-leveling`): a geometric formula `xpToNext(L) = base × growth^L` (base 100, growth ≈1.08) spanning levels 1–100 with a soft cap at L90, plus XP sources, a per-level reward schedule, catch-up mechanics, and a death-penalty XP sink. It realizes as a `CT_XPRequirements` UCurveTable consumed by `UARPGProgressionComponent`, with `GE_AwardXP` granting XP into `UARPGAttributeSet.XP` and `OnXPChanged` driving `CharacterLevel` increments.

## Target / starter entity
- **Hero Level Curve** (`curve-hero-level`, XP) — The main character XP-to-level curve.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength` brief ≥ 300 chars |
| 2 | Curve Formula | schema | — | L0 `fieldsPopulated` (formula/base/exponent/softCap) + L2 `cppSymbolExists` FARPGXPCurveRow |
| 3 | XP Sources | rules | — | L0 `fieldsPopulated` (kills/quests/exploration/scalingNote) |
| 4 | Reward Schedule | rules | — | L0 `fieldsPopulated` (passivePoints/milestoneUnlocks/ascendancyGates) |
| 5 | Caps & Catch-up | rules | — | L0 `fieldsPopulated` (softCap/hardCap/catchupMechanics/antiGrind) |
| 6 | Death Penalty | rules | — | L0 `fieldsPopulated` + L2 `cppSymbolExists` GE_DeathPenaltyXP |
| 7 | Balance | balance | — | L0 `withinPercent` minutesToNextLevel within ±20% of 45-min target |
| 8 | Telemetry | rules | — | L0 `fieldsPopulated` (events/sink) |
| 9 | XP Bar UI | rules | WBP_XPBar, WBP_LevelUpNotification | L0 `fieldsPopulated` (widget/format/position/hudBinding) |
| 10 | Icon 2D Art | gallery | T_\<name\>_LevelUpIcon | L1 `selected` (progression icon) |
| 11 | Test Gate | checklist | — | L3 `runtimeDeferred` VSProgressionCurveTest |
| 12 | UE Packaging | manifest | CT_XPRequirements, GE_AwardXP, GE_DeathPenaltyXP, T_\<name\>_LevelUpIcon, WBP_XPBar, NS_LevelUpBurst | L0 `minCount` ≥4 + L2 `cppSymbolExists` FARPGXPCurveRow, `seedRowPresent` seed_progression_curves.py |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `FARPGXPCurveRow` (steps 2, 12), `GE_DeathPenaltyXP` (step 6).
- **Curve table / GEs:** `CT_XPRequirements` (UCurveTable), `GE_AwardXP`, `GE_DeathPenaltyXP`; consumed by `UARPGProgressionComponent` (`OnXPChanged`, `GrantLevelUpRewards`, `ApplyDeathPenalty`).
- **Seed script** (`seedRowPresent`): `seed_progression_curves.py` (UE Packaging).
- **Runtime test** (`runtimeDeferred`): `VSProgressionCurveTest` — XP → level-up at declared thresholds in PIE.
- **Cross-catalog links** (`links:`): `icon-sets::iconset-abilities` (progression icon, steps 10 & 12). Wiring contracts also depend on `characters` (CharacterLevel/XP attributes, passive tree), `quests`, `bestiary` (monster XP), and `hud-elements` (XP bar slot).

## Acceptance profile
Uses **L0 (data)** for the bulk (brief, formula, sources, rewards, caps, balance, telemetry, UI, manifest), **L1 (human-selection)** for the icon gallery, **L2 (static UE source)** via `FARPGXPCurveRow`/`GE_DeathPenaltyXP` symbol checks and the `seed_progression_curves.py` seed-row check, and **L3 (runtime-deferred)** for the `VSProgressionCurveTest` gate. Config-complete = all L0/L1/L2 checks pass and the Test Gate is `deferred` with the runtime reason.

## Status & notes
Largest of this batch (12 steps). Obeys ARPG-LAWS §9 (soft-cap/long-grind, passive-point allocation) and canon `game-pillars` (earned power, anti-grind diminishing returns, no rested-XP). The Balance step contains a documented self-recalibration comment (per-level vs per-session metric) landing at ≈45.1 min for L50→L51. Death penalty is the canonical XP sink. No bridge-driven steps; all production is synchronous data + deferred runtime.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
