# Factions Pipeline

> Catalog ID `factions` · Category Quests & Narrative · `dialogue-quests` module · 11 steps · Tracks: logic, art-2d, audio, test

**Purpose.** Models group affiliations with a 6-tier (here 7-row) standing ladder (Hated → Exalted), concrete rep thresholds and decay, action→rep deltas, and a linear discount reward curve (0 → 20%) that satisfies canon `vendor-laws`. `UARPGFactionSubsystem` holds per-player `repPoints` per `factionId`, evaluates thresholds on change, and broadcasts a `RepTierChanged` delegate; vendors query `GetRepTier(factionId, playerId)` to apply the linear discount; quests grant rep via `GE_QuestRep_<factionId>` (SetByCaller magnitude). The subsystem reads `FARPGFactionRow` from `DT_Factions` (seeded via `seed_factions.py`) and per-player rep from `DT_FactionReputation`.

## Target / starter entity
- **The Ashen Order** (`faction-ashen-order`) — A militant order in the post-Sundering dark-fantasy setting with a reputation ladder. The player begins Neutral and progresses or regresses across the tiers via quests, kills, trades, and hostile acts. Captain Vael (`char-captain-vael`) is the primary quest-giver and rank arbiter; standing gates vendor stock and discount tiers.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength('brief', ≥300)` |
| 2 | Standing & Rep Tiers | rules | — | L0 · `minCount('tiers', ≥6)` **+ L2** `cppSymbolExists('UARPGFactionSubsystem')`, `cppSymbolExists('FARPGFactionRow')` |
| 3 | Action → Reputation | rules | — | L0 · `minCount('actionDeltas', ≥8)` |
| 4 | Tier Rewards | rules | — | L0 · `minCount('tierRewards', ≥4)` |
| 5 | NPC Members | rules | — | L0 · `minCount('members', ≥1)` **+ L2** `seedRowPresent('seed_factions.py', <slug>)` |
| 6 | Greeting & Disposition Hooks | rules | — | L0 · `minCount('greetingHooks', ≥5)` |
| 7 | Standing UI | rules | `WBP_FactionRepBar` | L0 · `fieldsPopulated('standingUi', [widget, format, anchor])` |
| 8 | Heraldry Icon | gallery | `T_<name>_Sigil`, `T_<name>_Emblem_{Friendly,Honored,Exalted}` | L1 · `selected('selected')` |
| 9 | Localization | checklist | — | L0 · `minCount('keys', ≥1)` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred('VSFactionRepTest')` |
| 11 | UE Packaging | manifest | `DT_Factions::<s>`, `DT_FactionReputation::<s>`, `DT_FactionDialogue::<s>`, `T_<s>_Sigil`, `WBP_FactionRepBar`, `WBP_FactionTierToast`, `BP_FactionSubsystem_<s>` | L0 · `minCount('assets', ≥5)` **+ L2** `cppSymbolExists('UARPGFactionSubsystem')`, `cppSymbolExists('FARPGFactionRow')`, `cppSymbolExists('FARPGFactionReputationRow')`, `seedRowPresent('seed_factions.py', <slug>)` |

## UE wiring
- **C++ symbols (checked via `cppSymbolExists`):** `UARPGFactionSubsystem` (World Subsystem; `EvaluateTier` / `AddRepPoints` / `GetRepTier`, `RepTierChanged` delegate), `FARPGFactionRow`, `FARPGFactionReputationRow`. Also referenced: `UARPGVendorComponent.ComputeFinalPrice` (discount consumer), `UARPGDialogComponent.SelectGreeting(repTier)`, `AARPGNPCActor.SetHostile`.
- **DataTables:** `DT_Factions` (tier thresholds, keyed by entity slug), `DT_FactionReputation` (per-player rep), `DT_FactionDialogue` (7-tier greeting rows), `ST_FactionDialogue` (StringTable).
- **GameplayEffects:** `GE_QuestRep_Factions` (SetByCaller rep grant), `GE_FactionTierUp_{Friendly,Honored,Revered,Exalted}`.
- **Widgets:** `WBP_FactionRepBar`, `WBP_FactionTierToast` (color via SEVERITY_TOKENS — no hardcoded hex, per coding conventions), vendor header discount line.
- **Seed script (checked via `seedRowPresent`):** `seed_factions.py` (seeds the faction slug row in `DT_Factions` + `DT_FactionReputation`); `char-captain-vael` in `seed-characters.ts`.
- **Runtime test:** `VSFactionRepTest` (PIE — full tier-transition loop with discount verification: 3000→Friendly, 12000→Exalted, Exalted price 20% below Neutral).
- **Cross-catalog links:** currencies (`currency-gold` Friendly reward package), items (`item-6` Sunfire Amulet Honored stock), vendors (`vendor-wandering-merchant` discount consumer), characters (`char-captain-vael` faction leader), icon-sets (`iconset-abilities` heraldry icon family).

## Acceptance profile
Tiers used: **L0** (data — tiers/deltas/rewards/members/hooks/UI/loc/assets), **L1** (human selection — heraldry icon gallery), **L2** (static UE source — `cppSymbolExists` for the subsystem + row structs on steps 2 & 11, `seedRowPresent('seed_factions.py')` on steps 5 & 11), **L3** (runtime-deferred — `VSFactionRepTest`). No L4 visual gate. Config-complete means: the data floors are met (≥6 tiers, ≥8 action deltas, ≥4 tier rewards, ≥5 greeting hooks, ≥5 packaged assets), an icon is selected, **and the L2 static checks pass** (the C++ subsystem/row structs exist in Source and the faction row is present in `seed_factions.py`) — full tier-transition + discount behavior deferred to PIE.

## Status & notes
11 steps. The only pipeline in this batch with **L2 static checks** — it asserts the real UE source (`UARPGFactionSubsystem`, `FARPGFactionRow`, `FARPGFactionReputationRow`) and the seed row exist before counting config-complete. Obeys canon `vendor-laws` (linear discount off repTier, ceiling 20%, no custom curves), proj-balance (Exalted ≈ 24 main quests, never automatic — "power is earned, not gifted" per game-pillars), proj-hud-binding, and the no-hardcoded-hex coding convention (SEVERITY_TOKENS). The 7-tier ladder spans −10000 (Hated) to +15000 (Exalted) with passive 10 pts/day decay at/above Revered (floored at Honored). Bridge-driven runtime verification is deferred to `VSFactionRepTest`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
