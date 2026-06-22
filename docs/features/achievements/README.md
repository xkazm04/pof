# Achievements Pipeline

> Catalog ID `achievements` · Category Systems · `arpg-progression` module · 12 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** Authors a server-authoritative player accomplishment tracked across sessions. Each achievement listens to one or more gameplay events, increments an integer progress counter, and unlocks idempotently (exactly once per entity-player) when the counter reaches its threshold. It realizes as a `DT_Achievements` row + `GE_Achievement_<Slug>` reward effect, driven by `UARPGAchievementSubsystem` on the GameState (server-only), which RPC-notifies the owning `PlayerController` to fire the HUD toast and grant the reward via the player's ASC.

## Target / starter entity
- **First Blood** (`achievement-first-blood`, Combat) — Defeat your first enemy. Unlock condition: a single enemy kill (killCount ≥ 1) from `Event.Combat.EnemyKilled`.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 `minLength` brief ≥ 300 chars |
| 2 | Trigger & Progress | rules | — | L0 `fieldsPopulated` (gameplayEvent/progressMetric/threshold/guard) + L2 `cppSymbolExists` UARPGAchievementSubsystem |
| 3 | Hidden / Visible | rules | — | L0 `fieldsPopulated` (state/spoilerPolicy/unlockReveal) |
| 4 | Reward Binding | rules | GE_Achievement_\<name\> | L0 `minCount` ≥1 reward link + L2 `cppSymbolExists` UARPGAchievementSubsystem, `seedRowPresent` seed_achievements.py |
| 5 | Platform Spec | rules | — | L0 `fieldsPopulated` (steam/psn/xbox) |
| 6 | Icon 2D Art | gallery | T_\<name\>_AchievementIcon | L1 `selected` (badge icon) |
| 7 | Unlock Toast | rules | — | L0 `fieldsPopulated` (widget/format/anchor/duration) |
| 8 | Anti-Cheat / Validation | rules | — | L0 `fieldsPopulated` + L2 `cppSymbolExists` UARPGAchievementSubsystem |
| 9 | Telemetry | rules | — | L0 `fieldsPopulated` (events/metric) + L2 `cppSymbolExists` UARPGTelemetrySubsystem |
| 10 | Localization | checklist | — | L0 `minCount` ≥1 loc key |
| 11 | Test Gate | checklist | — | L3 `runtimeDeferred` VSAchievementTest |
| 12 | UE Packaging | manifest | DT_Achievements, GE_Achievement_\<name\>, T_\<name\>_AchievementIcon, WBP_AchievementToast, SC_AchievementUnlock | L0 `minCount` ≥2 + L2 `cppSymbolExists` UARPGAchievementSubsystem & FARPGAchievementRow, `seedRowPresent` seed_achievements.py |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGAchievementSubsystem` (steps 2, 4, 8, 12 — server-only, `HasAuthority()`), `FARPGAchievementRow` (step 12), `UARPGTelemetrySubsystem` (step 9).
- **DataTables / GEs:** `DT_Achievements` row, `GE_Achievement_<Slug>` (executes `UARPGCurrencyExecution` +100 gold and `UARPGInventoryGrantExecution` +1 item-7); toast `WBP_AchievementToast` at `AchievementToastAnchor`; platform notify via `UAchievementOnlineSubsystem` (canonical id `ACH_FIRST_BLOOD`).
- **Seed script** (`seedRowPresent`): `seed_achievements.py` (steps 4 & 12).
- **Runtime test** (`runtimeDeferred`): `VSAchievementTest` — kill fires unlock + reward grants exactly once in PIE.
- **Cross-catalog links** (`links:`): `currencies::currency-gold` (unlock-reward-gold) and `items::item-7` (Minor Health Potion, unlock-reward-item) in step 4; `icon-sets::iconset-abilities` (badge/toast icon) in steps 6, 7, 12. Wiring depends on `bestiary` (kill event source), `hud-elements` (toast anchor), the Online Subsystem, and the save system (idempotency tag).

## Acceptance profile
Uses **L0 (data)** for most steps, **L1 (human-selection)** for the icon gallery, **L2 (static UE source)** via `UARPGAchievementSubsystem`/`FARPGAchievementRow`/`UARPGTelemetrySubsystem` symbol checks and `seed_achievements.py` seed-row checks, and **L3 (runtime-deferred)** for `VSAchievementTest`. Config-complete = all L0/L1/L2 pass and the Test Gate is `deferred` with the runtime reason.

## Status & notes
Server-authoritative design is central: unlock logic runs only under `HasAuthority()`, guarded by the persistent `Achievement.FirstBlood.Unlocked` world-state tag for idempotency, with an audit log + duplicate-suspicion counter (no auto-ban). Cross-system reward binding (gold + item) makes this a hub linking `currencies` and `items`. No bridge-driven steps; all production synchronous data + deferred runtime.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
