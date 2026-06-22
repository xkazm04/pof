# Quests Pipeline

> Catalog ID `quests` · Category Quests & Narrative · `dialogue-quests` module · 11 steps · Tracks: logic, audio, test

**Purpose.** Authors a multi-stage player objective — branching stages, triggers, world-state mutations, rewards, NPC bindings, and narrative beats. Quest state is tracked via an `AARPGQuestComponent` on the player character; stage transitions fire `Ability.Quest.*` GameplayEvents consumed by `UGameplayAbility_QuestAdvance`; rewards are granted via `GE_QuestReward_*` GameplayEffects on stage completion. The pipeline never re-authors loot/currency data — it links to loot-tables and currencies (canon proj-links).

## Target / starter entity
- **The Ember Pact** (`quest-ember-pact`) — A 3-stage introductory fetch-and-choice quest: discover the Ashen Order's pact ritual north of the Ashen Forest, forge (or refuse) the pact, and face the consequences. Two success terminals (PACT / REFUSE) and one failure terminal (BETRAYED, if Captain Vael is killed before stage 2 completes).

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength('brief', ≥300)` |
| 2 | Objective Graph | graph | — | L0 · `graphValid('graph')` — reachable + success & fail terminal |
| 3 | Triggers & World-State | rules | `DA_EmberPact_Conditions` | L0 · `fieldsPopulated('triggers', [start, fail, worldMutation])` |
| 4 | Rewards | rules | `DA_EmberPact_Rewards` | L0 · `minCount('rewards', ≥1)` |
| 5 | NPC & Dialog Binding | rules | — | L0 · `minCount('npcs', ≥1)` |
| 6 | Marker / Tracker UI | rules | `WBP_QuestTracker`, `T_EmberPact_MapIcon` | L0 · `fieldsPopulated('tracker', [widget, format, anchor])` |
| 7 | Journal / Lore | brief | — | L0 · `minLength('journal', ≥200)` |
| 8 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected('selected')` |
| 9 | Localization | checklist | — | L0 · `minCount('keys', ≥1)` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred('VSQuestFlowTest')` |
| 11 | UE Packaging | manifest | `DT_QuestStages_<s>`, `DA_<s>_Conditions`, `DA_<s>_Rewards`, `WBP_QuestTracker`, `T_<s>_Icon` | L0 · `minCount('assets', ≥3)` |

## UE wiring
- **C++ symbols:** `AARPGQuestComponent` (player-character quest tracker), `UGameplayAbility_QuestAdvance` (consumes stage GameplayEvents), `FARPGQuestStageRow`, `UARPGAttributeSet.CharacterLevel` (level-≥10 gate), `AARPGWorldStateComponent` (persists world-state tags), `AARPGNPCActor` + `UARPGDialogComponent` (Vael quest-start binding).
- **DataTables / DataAssets:** `DT_QuestStages_<s>` (FARPGQuestStageRow rows), `DA_EmberPact_Conditions` (gate values), `DA_EmberPact_Rewards` (per-terminal GE handles).
- **GameplayEffects:** `GE_QuestReward_EmberPact_Gold`, `GE_QuestReward_EmberPact_Rep`, `GE_QuestReward_EmberPact_RefuseGold`, `GE_WorldState_EmberPactActive`.
- **GameplayEvents:** `Ability.Quest.EmberPact.{Start | CoreCollected | Complete | CompletedRefuse | Betray}`.
- **Seed script:** `seed_quests.py` (seeds `DT_QuestStages_<s>`).
- **Runtime test:** `VSQuestFlowTest` (PIE — all three terminal paths reached, rewards granted, world-state tags applied).
- **Cross-catalog links:** loot-tables (`lt-Brute` PACT path, `lt-EliteKnight` REFUSE path), currencies (`currency-gold`), factions (`faction-ashen-order` rep +75), characters (`char-captain-vael` quest-giver), dialog-trees (`dialog-gatekeeper` stage-1 accept dialogue). Loot ilvl always sourced from player level per ARPG-LAWS §7; quests grant soft currency only (canon proj-economy).

## Acceptance profile
Tiers used: **L0** (data — brief/graph/triggers/rewards/npcs/tracker/journal/keys/assets), **L1** (human selection — icon gallery), **L3** (runtime-deferred — `VSQuestFlowTest`). No L2 static checks or L4 visual gates. Config-complete means: brief/journal prose meet length floors, the objective graph validates (reachable with a success and a fail terminal), all rule fields populate, an icon is selected, and ≥3 UE assets are packaged — with the live quest-flow behavior deferred to PIE.

## Status & notes
11-step pipeline anchored on the `graph` archetype (step 2) for the branching objective DAG with two success and one failure terminal. Obeys ARPG-LAWS §7 (loot ilvl = source level), canon proj-economy (soft currency only), and proj-links (links loot/currency/faction rather than re-authoring). Several wiring notes flag pending work: a dedicated `dt_ember_pact_choice` dialog tree and a "defector's cache" loot table are noted as future seeds (currently reuses `dialog-gatekeeper` and `lt-EliteKnight`). Bridge-driven runtime verification is deferred to `VSQuestFlowTest`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
