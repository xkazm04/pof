# Save / Checkpoint Pipeline

> Catalog ID `save-points` · Category Systems · `arpg-save` module · 12 steps · Tracks: logic, art-2d, vfx, audio, test

**Purpose.** Authors bonfire-style interact-to-save checkpoints. The save system serializes only DISCRETE world-state mutations (per canon `state-graph-fsm-wiring`): defeated enemies, completed quests, opened zones, committed attribute deltas. Ephemeral state (current AI tags, blackboard keys, in-flight GAS effects, unsettled combat) is NEVER persisted — it is discarded on session end and rebuilt from `UARPGAttributeSet` + `DT_AttributeDefaults` on load. Wires into UE5 via `BP_Bonfire` (a Blueprint child of `AARPGInteractableBase`) whose Overlap → interact → `UARPGSaveSubsystem::SaveToSlot` serializes `UARPGSaveGame` (a `USaveGame` subclass) and persists via `UGameplayStatics::SaveGameToSlot`.

## Target / starter entity
- **Bonfire Checkpoint** (`save-bonfire`) — An interact-to-save world checkpoint: a weathered-stone/runic-brazier persistence anchor the player rekindles to commit progress, supporting multiple slots (default 3) plus a hidden autosave slot.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | State Schema | schema | — | L0 · `fieldsPopulated(stateSchema: persisted/ephemeral/schemaVersion/fieldsNote)` + L2 static |
| 3 | Versioning & Migration | rules | — | L0 · `fieldsPopulated(versioning: currentVersion/migrationPolicy/upgradeRules/downgradePolicy)` |
| 4 | Save Triggers | rules | — | L0 · `fieldsPopulated(triggers: manualTrigger/autosaveTriggers/triggerDebounce/cooldownMs)` |
| 5 | Cloud / Local Storage | rules | — | L0 · `fieldsPopulated(storage: localPath/cloudStrategy/slotCount/fileSize)` |
| 6 | Conflict Resolution | rules | — | L0 · `fieldsPopulated(conflict: policy/timestampField/tieBreak/userPrompt)` |
| 7 | Corruption Recovery | rules | — | L0 · `fieldsPopulated(corruption: detectionMethod/recoveryPath/backupSlot/failsafeNewGame)` |
| 8 | Slots UI | rules | `WBP_SaveSlots`, `WBP_SaveIndicator` | L0 · `fieldsPopulated(slotsUI: widget/format/position/hudBinding)` |
| 9 | Load-Time Budget | balance | — | L0 · `withinPercent(measuredMs, 30, ±50%)` |
| 10 | Icon 2D Art | gallery | `T_<name>_Icon` | L1 · `selected` |
| 11 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSSaveLoadTest)` |
| 12 | UE Packaging | manifest | `UARPGSaveGame`, `BP_Bonfire`, `UARPGSaveSubsystem`, `DA_SavePoint_`, `T_`, `WBP_SaveSlots`, `WBP_SaveIndicator` | L0 · `minCount(assets, ≥4)` + L2 statics |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `UARPGSaveGame` (steps 2/12), `UARPGSaveSubsystem` (step 12), `AARPGInteractableBase` (step 12 — `BP_Bonfire` parent). Save flow: `UARPGSaveSubsystem::SaveToSlot` → `UGameplayStatics::SaveGameToSlot("PoFSave_<slot>")`; load inverts via `DeserializeSave` / `MigrateSaveGame` / `ValidateSaveGame`. `BP_Bonfire` is config, not new C++ (canon `char-config-not-cpp`).
- **DataAssets / widgets**: `DA_SavePoint_<name>` (registers the `State.Checkpoint.*` tag), `WBP_SaveSlots` + `WBP_SaveIndicator` (pushed via `AARPGHUD::ShowSaveSlots`, per `proj-hud-binding` / `screen-flow-nav-contract`).
- **Runtime test** (`runtimeDeferred`): `VSSaveLoadTest` — save → reload restores persisted fields (level, gold, defeated-enemy tags), ephemeral state absent, autosave on zone/quest events, CRC-32 corruption recovery, in PIE.
- **Cross-catalog dependencies** (declared in `wiringContract`, no resolvable `links` except icon): `characters` (`DT_AttributeDefaults` baseline), `quests` (`FARPGQuestSaveEntry`), `factions` (repStandings), `items` (`FARPGSavedItemEntry`), `currencies` (walletGold + walletOrbs), `hud-elements` (`WBP_SaveIndicator`), `zone-map` (`UARPGZoneSubsystem::OnZoneTransition`). Step 10 links `icon-sets::iconset-abilities` (icon-family).

## Acceptance profile
Uses L0 (data: brief + 6 rules tables + state schema + load-time budget + asset count), L1 (gallery: bonfire icon), L2 (static UE source: `UARPGSaveGame`, `UARPGSaveSubsystem`, `AARPGInteractableBase`), and one L3 deferred gate (`VSSaveLoadTest`). L4 visual is not used. "Config-complete" means all data/selection/static steps reach `pass` and the Test Gate terminates `deferred` (save → reload round-trip + ephemeral discard verified in PIE).

## Status & notes
12-step pipeline (tied with characters as the largest in this batch), heavy on declarative rules tables (versioning, triggers, storage, conflict, corruption). Obeys canon `state-graph-fsm-wiring` (only discrete `State.*` tags that have fired persist; running state is ephemeral), `proj-hud-binding`, and `char-config-not-cpp` (`BP_Bonfire` is a Blueprint child, no new C++). The Load-Time Budget `withinPercent` target (30 ms ±50%) is met by a ~15 ms synchronous derivation (file read + CRC + deserialize + tag/attribute/inventory restore; zone streaming is async, excluded). Bridge-driven runtime save/load behavior is deferred to PIE. Phase 1 is local-only; Steam Cloud sync, conflict dialogs, and ZLIB compression are documented Phase-2 gaps.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
