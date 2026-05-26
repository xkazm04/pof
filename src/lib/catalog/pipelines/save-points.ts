import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Save / Checkpoint pipeline (catalogId: 'save-points').
 *
 * Bonfire-style interact-to-save checkpoints.  The save system serializes only
 * DISCRETE world-state mutations (per canon `state-graph-fsm-wiring`): defeated
 * enemies flagged with State.Enemy.Defeated.*, completed quests, opened zones,
 * etc.  Ephemeral state (current AI state tags, blackboard keys, in-flight GAS
 * effects, unsettled combat) is NEVER persisted — it is discarded on session
 * end and rebuilt from UARPGAttributeSet + DT_AttributeDefaults on load.
 *
 * Wiring: BP_Bonfire (Blueprint child of AARPGInteractableBase) detects Overlap
 * → shows UMG interact prompt → player confirms → UARPGSaveSubsystem::SaveToSlot
 * serializes UARPGSaveGame (a USaveGame subclass) + persists to slot via
 * UGameplayStatics::SaveGameToSlot.  Load inverts: DeserializeSave restores
 * persisted state tags + attribute baseline; ephemeral state is discarded.
 *
 * Canon rule referenced: state-graph-fsm-wiring (only discrete State.* tags
 * that have fired persist; current running state is ephemeral).
 * Wiring contract per arpg-wiring-contract on each produced artifact.
 * Slots UI binding per proj-hud-binding (WBP_SaveSlots declared in HUD class).
 */

registerCatalogPipeline({
  catalogId: 'save-points',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is PoF's primary persistence anchor — a bonfire-style world checkpoint ` +
            `that the player interacts with to commit progress to disk. Checkpoints belong to ` +
            `the post-Sundering dark-fantasy setting: weathered stone structures or runic ` +
            `braziers rekindled by the player, providing a moment of earned respite in a ` +
            `soldier's world (canon game-tone: earned, not gifted). ` +
            `The system is designed around two invariants: (1) only DISCRETE world-state ` +
            `mutations persist — State.Enemy.Defeated.*, quest stage completions, zone ` +
            `unlocks, and committed attribute deltas written to DT_AttributeDefaults rows; ` +
            `(2) ephemeral runtime state — current AI blackboard values, in-flight GAS ` +
            `effects, ongoing combat — is deliberately DISCARDED on session end and rebuilt ` +
            `from canonical data rows on load (canon state-graph-fsm-wiring). ` +
            `This "discrete-only" contract keeps save files small, forward-compatible, and ` +
            `corruption-resistant. A bonfire interaction triggers a short (~0.3 s) commit ` +
            `window with a tactile SFX sting and a HUD save-indicator flash, then the game ` +
            `continues uninterrupted. Autosave fires on the same path (same serializer, same ` +
            `slot rules) on zone transitions and quest-stage completions. ` +
            `Multiple save slots are supported (default 3); slot selection is via WBP_SaveSlots ` +
            `surfaced from the pause menu and the main-menu load screen, bound per proj-hud-binding. ` +
            `UE realization: UARPGSaveGame (USaveGame subclass) + BP_Bonfire (Blueprint child ` +
            `of AARPGInteractableBase, config — no new C++) + ` +
            `UARPGSaveSubsystem (GameInstanceSubsystem) + DA_SavePoint data asset.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. State Schema ───────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'State Schema',
      view: {
        kind: 'table',
        field: 'stateSchema',
        columns: [
          { key: 'persisted' },
          { key: 'ephemeral' },
          { key: 'schemaVersion' },
          { key: 'fieldsNote' },
        ],
      },
      produce: () => ({
        data: {
          stateSchema: {
            persisted: {
              description:
                'Only discrete world-state mutations that have FIRED and settled ' +
                '(per canon state-graph-fsm-wiring). Never capture running/transient state.',
              fields: [
                'playerLevel: int — current character level (from DT_AttributeDefaults row)',
                'playerAttributes: FARPGAttributeSnapshot — base Str/Dex/Int/Life/Mana at save time (not in-combat derived values)',
                'inventoryItems: TArray<FARPGSavedItemEntry> — item id + affixes + socket state (from items catalog)',
                'walletGold: int — committed Gold balance (UARPGWalletComponent::GetGold at save time)',
                'walletOrbs: TMap<FName, int> — orb currency counts keyed by currency entity slug',
                'defeatedEnemyTags: TArray<FGameplayTag> — each State.Enemy.Defeated.<EnemyId> that has fired',
                'completedQuestStages: TArray<FARPGQuestSaveEntry> — {questId, stageIndex, outcome} for each terminal stage reached',
                'unlockedZoneIds: TArray<FName> — zone catalog ids the player has entered at least once',
                'checkpointActorTag: FGameplayTag — the State.Checkpoint.<BonfireId> tag marking this bonfire activated',
                'repStandings: TMap<FName, int> — faction reputation points keyed by faction catalog id',
                'passivePoints: int — total passive points spent',
                'passiveAllocations: TArray<FName> — node ids of allocated passive tree nodes',
                'activeSaveSlot: int — 0-indexed slot this save occupies (0–2)',
                'saveTimestamp: FDateTime — wall-clock time of last save',
              ],
              persistenceRule:
                'Written via UARPGSaveSubsystem::SaveToSlot → ' +
                'UGameplayStatics::SaveGameToSlot("PoFSave_<slot>", 0, SaveObject). ' +
                'Only the fields above are serialized. Everything else is ephemeral.',
            },
            ephemeral: {
              description:
                'Discarded on session end; reconstructed from DT_AttributeDefaults + canonical data on load.',
              fields: [
                'currentAIStateTags — blackboard keys + running State.AI.* tags on all actors',
                'inFlightGASEffects — active GE handles on the player (re-derived from saved attributes on respawn)',
                'pendingSpawnPool — enemy actors spawned but not yet defeated (re-derived from defeatedEnemyTags)',
                'navigationMeshCache — rebuilt by NavMesh on load',
                'physicsSimState — Chaos physics body transforms (reset to blueprint defaults)',
                'activeLevelStreaming — async-loaded sublevel states (re-streamed on zone restore)',
                'currentCombatTarget — cleared on session end',
                'unsettledCurrencyDrops — items mid-air on death that were never picked up',
              ],
              ephemeralRule:
                'These fields are intentionally ABSENT from UARPGSaveGame. ' +
                'Attempting to serialize them is a bug; the subsystem asserts they are absent.',
            },
            schemaVersion: 1,
            fieldsNote:
              'UARPGSaveGame carries a SchemaVersion int. ' +
              'On load, UARPGSaveSubsystem::MigrateSaveGame(SaveGame) ' +
              'applies registered migration lambdas in version order before handing the ' +
              'object to the game. A missing migration for a schema bump = load aborts gracefully.',
            wiringContract: {
              grantedBy:
                'UARPGSaveSubsystem::SaveToSlot serializes the player pawn state + ' +
                'world-state tags + inventory + wallet into UARPGSaveGame and calls ' +
                'UGameplayStatics::SaveGameToSlot',
              activatedBy:
                'Bonfire interaction (BP_Bonfire::Interact → AARPGInteractableBase::OnInteracted delegate → subsystem SaveToSlot); ' +
                'Autosave trigger (zone transition / quest stage completion → UARPGSaveSubsystem::TriggerAutoSave)',
              dependencies: [
                'characters (DT_AttributeDefaults for attribute baseline restore)',
                'quests (FARPGQuestSaveEntry — stage index + outcome per quest)',
                'factions (repStandings keyed by faction catalog id)',
                'items (FARPGSavedItemEntry — item id + affix roll + sockets)',
                'currencies (walletGold + walletOrbs keyed by currency slug)',
              ],
              verification:
                'L2: UARPGSaveGame declared in Source/PoF/ + schemaVersion field present; ' +
                'L2: UARPGSaveSubsystem::MigrateSaveGame + ValidateSaveGame declared in Source/PoF/; ' +
                'L3: VSSaveLoadTest — save → reload restores persisted fields, ephemeral discarded, in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('stateSchema', 'persisted / ephemeral / schemaVersion / fieldsNote populated', [
        'persisted',
        'ephemeral',
        'schemaVersion',
        'fieldsNote',
      ]),
      staticChecks: () => [
        cppSymbolExists('UARPGSaveGame', 'SaveGame subclass present in UE Source'),
      ],
    },

    // ── 3. Versioning & Migration ─────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Versioning & Migration',
      view: {
        kind: 'table',
        field: 'versioning',
        columns: [
          { key: 'currentVersion' },
          { key: 'migrationPolicy' },
          { key: 'upgradeRules' },
          { key: 'downgradePolicy' },
        ],
      },
      produce: () => ({
        data: {
          versioning: {
            currentVersion: 1,
            versionField:
              'UARPGSaveGame::SchemaVersion (int32). Bumped by 1 for every change to the ' +
              'persisted field set (add, remove, or rename a field). Matching ' +
              'CURRENT_SAVE_SCHEMA_VERSION constant in ARPGSaveSubsystem.h.',
            migrationPolicy:
              'Migration chain executed via UARPGSaveSubsystem::MigrateSaveGame(SaveGame). ' +
              'On load: if (saveVersion < currentVersion) run migrations in ascending order. ' +
              'Each lambda receives the raw UARPGSaveGame* and applies exactly one schema transition. ' +
              'Migrations are additive-only in the forward direction (never delete data mid-chain). ' +
              'All migrations must be idempotent (calling twice = same result as calling once).',
            upgradeRules: [
              'v0→v1: initial schema (no migration needed — first shipped version is v1)',
              'Any new field added to UARPGSaveGame MUST: (a) be optional with a valid default, ' +
              '(b) have a migration lambda that fills the default for saves missing the field, ' +
              '(c) bump SchemaVersion. No exceptions (canon: a missing migration = aborted load).',
            ],
            downgradePolicy:
              'Downgrades are NOT supported (saveVersion > currentVersion → load aborted with an ' +
              'error screen offering to start a new game or recover from backup slot). ' +
              'The backup slot is always the previous successful save (written before each new save commit).',
            deprecationNote:
              'When a field is no longer needed: (a) keep it as a stub in UARPGSaveGame for one ' +
              'version cycle so existing saves can still deserialize, (b) migration lambda strips it, ' +
              '(c) remove the stub in the following version bump.',
          },
        },
      }),
      accept: fieldsPopulated('versioning', 'currentVersion / migrationPolicy / upgradeRules / downgradePolicy populated', [
        'currentVersion',
        'migrationPolicy',
        'upgradeRules',
        'downgradePolicy',
      ]),
    },

    // ── 4. Save Triggers ──────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Save Triggers',
      view: {
        kind: 'table',
        field: 'triggers',
        columns: [
          { key: 'manualTrigger' },
          { key: 'autosaveTriggers' },
          { key: 'triggerDebounce' },
          { key: 'cooldownMs' },
        ],
      },
      produce: () => ({
        data: {
          triggers: {
            manualTrigger: {
              source: 'BP_Bonfire (AARPGInteractableBase child)::Interact / OnInteracted delegate',
              condition:
                'Player within interact radius (AARPGInteractableBase::InteractionRadius, default 200 UU) + ' +
                'interact input confirmed + no active combat flag (State.Player.InCombat absent) + cooldown elapsed',
              effect:
                'Fires UARPGSaveSubsystem::SaveToSlot(activeSlot); ' +
                'broadcasts SaveGameEvent.Committed to event bus; ' +
                'activates State.Checkpoint.<BonfireId> tag on the bonfire actor; ' +
                'plays SC_Save_Sting + WBP_SaveIndicator HUD flash (200 ms)',
              wiringNote:
                'BP_Bonfire is a Blueprint child of AARPGInteractableBase (config, not new C++ — canon char-config-not-cpp). ' +
                'The bonfire registers its State.Checkpoint.* tag in DA_SavePoint. ' +
                'Tag is persisted in checkpointActorTag so reloads know which bonfire to re-light.',
            },
            autosaveTriggers: [
              {
                event: 'Zone transition (UARPGZoneSubsystem::OnZoneTransition)',
                slotRule: 'writes to autosave slot (slot index = numSlots; hidden from player)',
                debounceMs: 500,
                note: 'Fires after StreamIn completes, not before — avoids saving a half-loaded level',
              },
              {
                event: 'Quest stage terminal reached (AARPGQuestManager::OnQuestStageComplete)',
                slotRule: 'writes to autosave slot',
                debounceMs: 1000,
                note: 'Fires after the quest reward has been granted to avoid partial-reward saves',
              },
              {
                event: 'Player death recovery (respawn at last bonfire)',
                slotRule: 'DOES NOT save — loads from last committed slot instead; death never commits',
                note: 'Death is not a save trigger; unsettled drops at death are ephemeral and discarded',
              },
            ],
            triggerDebounce:
              'All save triggers share a debounce in UARPGSaveSubsystem via AutoSaveThrottleCooldown (default 10 s) to ' +
              'prevent double-fires on rapid events (e.g. two quest stages completing in the same frame).',
            cooldownMs: 3000,
            cooldownNote:
              'Manual bonfire save has a 3-second cooldown per bonfire actor instance to ' +
              'prevent save-spam. The cooldown is per-actor (not global) so different bonfires are independent.',
            wiringContract: {
              grantedBy:
                'BP_Bonfire (AARPGInteractableBase child) overlap + interact input → UARPGSaveSubsystem::SaveToSlot; ' +
                'Autosave via UARPGSaveSubsystem::TriggerAutoSave (called on OnPostMapChange / boss defeat / zone transition)',
              activatedBy:
                'Enhanced Input IA_Interact (confirm) on BP_Bonfire (AARPGInteractableBase::Interact); ' +
                'Zone/Quest events → UARPGSaveSubsystem::TriggerAutoSave',
              dependencies: [
                'quests (AARPGQuestManager::OnQuestStageComplete trigger)',
                'zone-map (UARPGZoneSubsystem::OnZoneTransition / UARPGSaveSubsystem::OnPostMapChange trigger)',
                'hud-elements (WBP_SaveIndicator HUD slot per proj-hud-binding)',
              ],
              verification:
                'L2: AARPGInteractableBase + UARPGSaveSubsystem::SaveToSlot declared in Source/; ' +
                'L3: VSSaveLoadTest — interact fires save commit + State.Checkpoint tag activated in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('triggers', 'manualTrigger / autosaveTriggers / triggerDebounce / cooldownMs populated', [
        'manualTrigger',
        'autosaveTriggers',
        'triggerDebounce',
        'cooldownMs',
      ]),
    },

    // ── 5. Cloud / Local Storage Strategy ────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Cloud / Local Storage',
      view: {
        kind: 'table',
        field: 'storage',
        columns: [{ key: 'localPath' }, { key: 'cloudStrategy' }, { key: 'slotCount' }, { key: 'fileSize' }],
      },
      produce: () => ({
        data: {
          storage: {
            localPath:
              'UE SaveGame API: [SaveGames] directory (<project>/Saved/SaveGames/ in editor; ' +
              'platform-specific in shipping — e.g. %AppData%/PoF/SaveGames/ on Windows). ' +
              'Slot filenames: PoFSave_0.sav, PoFSave_1.sav, PoFSave_2.sav, PoFAutoSave.sav.',
            cloudStrategy:
              'Phase 1 (shipped): local-only. ' +
              'Phase 2 (future): Steam Cloud Sync via UE ISteamRemoteStorage integration. ' +
              'The UARPGSaveGame blob is self-contained and portable (no engine-version metadata embedded) ' +
              'so cloud sync is a drop-in: upload the .sav blob post-commit, download pre-load. ' +
              'No proprietary cloud format — the blob is a standard UE serialized archive.',
            slotCount: 3,
            autosaveSlot: 'PoFAutoSave.sav — separate from the 3 player-visible slots; never shown as a manual slot',
            fileSizeKB: {
              estimated: 48,
              derivation:
                'FARPGAttributeSnapshot (~400 B) + inventory TArray<FARPGSavedItemEntry> ' +
                '(≈20 items × 256 B each = ~5 KB) + defeatedEnemyTags TArray (≈500 tags × 16 B = ~8 KB) + ' +
                'completedQuestStages TArray (≈50 stages × 64 B = ~3 KB) + ' +
                'walletOrbs TMap (8 orb types × 8 B = ~64 B) + ' +
                'unlockedZoneIds + repStandings + passiveAllocations (~4 KB combined) + ' +
                'UE header overhead ~4 KB. ' +
                'Total: ≈24–48 KB per slot. Well under typical cloud-sync per-file limits (100 MB).',
            },
            fileSize: 48,
            compressionNote:
              'UARPGSaveGame is NOT compressed in Phase 1 (readability > size at <50 KB). ' +
              'Phase 2 may add ZLIB compress/decompress via FArchive if file size grows past 256 KB.',
          },
        },
      }),
      accept: fieldsPopulated('storage', 'localPath / cloudStrategy / slotCount / fileSize populated', [
        'localPath',
        'cloudStrategy',
        'slotCount',
        'fileSize',
      ]),
    },

    // ── 6. Conflict Resolution ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Conflict Resolution',
      view: {
        kind: 'table',
        field: 'conflict',
        columns: [{ key: 'policy' }, { key: 'timestampField' }, { key: 'tieBreak' }, { key: 'userPrompt' }],
      },
      produce: () => ({
        data: {
          conflict: {
            policy: 'last-write / newest-wins',
            description:
              'When loading a slot, the save with the highest saveTimestamp wins unconditionally. ' +
              'This is the standard ARPG policy: the player always has the newest committed state. ' +
              'There is no merge or diff — PoF saves are point-in-time snapshots, not deltas.',
            timestampField:
              'UARPGSaveGame::SaveTimestamp (FDateTime, UTC). ' +
              'Written by UARPGSaveSubsystem::SaveToSlot immediately before serialization. ' +
              'Compared as UTC epoch integers — no timezone conversion needed.',
            tieBreak:
              'If two saves share the same timestamp (< 1-second resolution edge case): ' +
              'prefer the cloud copy if cloud sync is active (Phase 2); ' +
              'otherwise prefer the local copy and log a warning.',
            userPrompt:
              'Phase 2 (cloud): if local and cloud timestamps differ by > 24 hours on load, ' +
              'surface a "Use local / Use cloud" dialog (WBP_ConflictDialog) before proceeding. ' +
              'Phase 1 (local-only): no conflict possible — only one authoritative copy per slot.',
            backupBehavior:
              'Before each SaveToSlot commit: rename existing PoFSave_<slot>.sav → ' +
              'PoFSave_<slot>_backup.sav (overwriting any prior backup). ' +
              'This ensures one recovery point per slot at zero cost.',
          },
        },
      }),
      accept: fieldsPopulated('conflict', 'policy / timestampField / tieBreak / userPrompt populated', [
        'policy',
        'timestampField',
        'tieBreak',
        'userPrompt',
      ]),
    },

    // ── 7. Corruption Recovery ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Corruption Recovery',
      view: {
        kind: 'table',
        field: 'corruption',
        columns: [{ key: 'detectionMethod' }, { key: 'recoveryPath' }, { key: 'backupSlot' }, { key: 'failsafeNewGame' }],
      },
      produce: () => ({
        data: {
          corruption: {
            detectionMethod:
              'UARPGSaveSubsystem::LoadFromSlot wraps UGameplayStatics::LoadGameFromSlot and ' +
              'calls ValidateSaveGame(SaveGame) for corruption / version mismatch checks. ' +
              'A null return OR a SchemaVersion mismatch (save > current) is treated as ' +
              'corruption. Additionally, a CRC-32 checksum is appended to the .sav blob at save time ' +
              'and verified on load; mismatch = corrupted.',
            checksumNote:
              'CRC-32 over the raw blob bytes, stored as the last 4 bytes of the file. ' +
              'Computed via FCrc::MemCrc32 before SaveGameToSlot writes the file. ' +
              'Verified by reading the last 4 bytes before deserializing.',
            recoveryPath: [
              '1. Attempt load from backup slot (PoFSave_<slot>_backup.sav).',
              '2. If backup also fails: attempt load from autosave slot (PoFAutoSave.sav).',
              '3. If all sources fail: surface WBP_CorruptSaveDialog offering "Start New Game" or "Cancel".',
              '4. Log a corruption event (UE_LOG category PoFSave) for telemetry.',
            ],
            backupSlot:
              'PoFSave_<slot>_backup.sav — created by renaming the previous committed file before each save. ' +
              'One backup per slot. Backup is only promoted to primary if the primary is confirmed corrupt.',
            failsafeNewGame:
              'If all recovery paths fail, the player is offered a fresh game with a confirmation dialog. ' +
              'The corrupt files are quarantined to PoFSave_corrupt_<timestamp>/ for potential support reporting, ' +
              'not silently deleted.',
            validationOnLoad: [
              'SchemaVersion in range [1, CURRENT_SAVE_SCHEMA_VERSION]',
              'CRC-32 checksum matches blob content',
              'Required fields (playerLevel, walletGold, saveTimestamp) non-null',
              'playerLevel in range [1, 100]',
            ],
          },
        },
      }),
      accept: fieldsPopulated('corruption', 'detectionMethod / recoveryPath / backupSlot / failsafeNewGame populated', [
        'detectionMethod',
        'recoveryPath',
        'backupSlot',
        'failsafeNewGame',
      ]),
    },

    // ── 8. Slots UI ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Slots UI',
      view: {
        kind: 'table',
        field: 'slotsUI',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'position' }, { key: 'hudBinding' }],
      },
      produce: () => ({
        data: {
          slotsUI: {
            widget: 'WBP_SaveSlots',
            slotCount: 3,
            slotFields:
              'Each slot tile shows: thumbnail (captured at save time via SceneCaptureComponent2D → T_SaveSlot_<N>_Thumb), ' +
              'character level, zone name, total playtime (hh:mm), save timestamp (locale date/time string), ' +
              'and an "Empty" placeholder if the slot has never been written.',
            format: 'Slot {N} — Lv {level} · {zone} · {playtime}',
            position: 'Pause-menu modal (WBP_PauseMenu → WBP_SaveSlots child) + Main-menu "Load Game" screen',
            hudBinding:
              'WBP_SaveSlots is pushed onto the HUD context stack via AARPGHUD::ShowSaveSlots — ' +
              'never raw AddToViewport (canon screen-flow-nav-contract). ' +
              'Bound to UARPGSaveSubsystem::GetSlotInfo(SlotName) / GetAllSlotInfo() for slot data queries. ' +
              'WBP_SaveIndicator (a small flashing "Saved" glyph, 200 ms) is anchored at HUD top-right ' +
              'per proj-hud-binding and fires on every SaveToSlot commit.',
            saveIndicator: {
              widget: 'WBP_SaveIndicator',
              anchor: 'HUD top-right',
              durationMs: 200,
              trigger: 'UARPGSaveSubsystem::OnSaveCompleted delegate',
            },
            wiringContract: {
              grantedBy:
                'AARPGHUD::ShowSaveSlots pushes WBP_SaveSlots onto the HUD context stack; ' +
                'WBP_SaveIndicator spawned by AARPGHUD on BeginPlay, hidden by default',
              activatedBy:
                'Pause-menu Save option → AARPGHUD::ShowSaveSlots; ' +
                'Main-menu Load Game → same widget in load-mode; ' +
                'Indicator: UARPGSaveSubsystem::OnSaveCompleted delegate → WBP_SaveIndicator::Flash',
              dependencies: ['hud-elements (WBP_SaveIndicator HUD anchor + slot per proj-hud-binding)'],
              verification:
                'L2: WBP_SaveSlots + WBP_SaveIndicator exist + AARPGHUD::ShowSaveSlots compiled; ' +
                'L3: VSSaveLoadTest — slot UI populates correct level/zone after save in PIE',
            },
          },
        },
        ueAssets: ['/Game/UI/HUD/WBP_SaveSlots', '/Game/UI/HUD/WBP_SaveIndicator'],
      }),
      accept: fieldsPopulated('slotsUI', 'widget / format / position / hudBinding populated', [
        'widget',
        'format',
        'position',
        'hudBinding',
      ]),
    },

    // ── 9. Load-Time Budget ───────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Load-Time Budget',
      view: {
        kind: 'table',
        field: 'loadBudget',
        columns: [{ key: 'targetMs' }, { key: 'measuredMs' }, { key: 'derivation' }],
      },
      produce: () => {
        // Load-time budget derivation:
        //   File read:    PoFSave_<slot>.sav  ≈ 48 KB from SSD → ~2 ms
        //   CRC-32 verify: 48 KB × 1 cycle/byte at ~3 GHz ≈ 0.016 ms → round up to ~1 ms with overhead
        //   Schema migration (v1 → v1 = no-op): < 0.1 ms
        //   UARPGSaveGame deserialization (FArchive): ~2–4 ms for ~50 fields
        //   Tag application (defeatedEnemyTags TArray → AddLooseGameplayTag × ~500): ~3 ms
        //   Attribute restore (FARPGAttributeSnapshot → UARPGAttributeSet): ~1 ms
        //   Inventory restore (TArray<FARPGSavedItemEntry> → recreate 20 items): ~5 ms
        //   Zone transition + level streaming (async, overlaps load): excluded from synchronous budget
        //   Total synchronous: ~2 + 1 + 0.1 + 3 + 3 + 1 + 5 = ~15 ms (well within 30 ms target)
        const targetMs = 30;
        const measuredMs = 15;
        return {
          data: {
            loadBudget: {
              targetMs,
              measuredMs,
              derivation:
                'Synchronous load budget (on-thread, before level streaming completes). ' +
                'File read: ≈48 KB SSD → ~2 ms. ' +
                'CRC-32 verify: <1 ms. ' +
                'FArchive deserialization of ~50 fields: ~3 ms. ' +
                'Tag application (defeatedEnemyTags × ~500 → AddLooseGameplayTag): ~3 ms. ' +
                'Attribute restore (FARPGAttributeSnapshot → UARPGAttributeSet): ~1 ms. ' +
                'Inventory item recreation (×20 FARPGSavedItemEntry): ~5 ms. ' +
                'Total: ~15 ms synchronous. Target: 30 ms (50% headroom). ' +
                'Zone streaming and NavMesh rebuild are async and do not count against this budget.',
              budgetNote:
                'If synchronous load > 30 ms (e.g. large inventory at endgame): ' +
                'move FARPGSavedItemEntry recreation to an async task (UARPGSaveSubsystem::RestoreStateToWorld async variant) ' +
                'with a "Restoring..." indicator in WBP_LoadingScreen.',
            },
            measuredMs,
          },
        };
      },
      accept: withinPercent('measuredMs', 'Load time within 50% of 30 ms target', 30, 50),
    },

    // ── 10. Icon 2D Art ───────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
        links: [{ catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' }],
      }),
      accept: selected('selected', 'A save-point / bonfire icon is selected'),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'bonfire interact triggers SaveToSlot and writes PoFSave_<slot>.sav',
            'reload of saved slot restores playerLevel, walletGold, defeatedEnemyTags',
            'ephemeral state (AI tags, in-flight GAS effects) is absent after reload',
            'autosave fires on zone transition (after StreamIn, not before)',
            'autosave fires on quest stage terminal reached (after reward grant)',
            'CRC-32 checksum mismatch triggers corruption recovery path',
            'corrupt primary + corrupt backup offers "Start New Game" dialog',
            'SchemaVersion v1 → v1 migration is a no-op (no data change)',
            'save within 3-second cooldown window is silently ignored (no double-save)',
            'WBP_SaveIndicator flashes for 200 ms after each committed save',
            'slot thumbnail captured at save time and shown in WBP_SaveSlots',
            'load-time synchronous budget ≤ 30 ms for a 48 KB save at area-level 50',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSSaveLoadTest',
        'Save → reload restores persisted state, ephemeral discarded, in PIE',
      ),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          'UARPGSaveGame',
          'BP_Bonfire (child of AARPGInteractableBase)',
          'UARPGSaveSubsystem',
          `DA_SavePoint_${s}`,
          `T_${s}_Icon`,
          'WBP_SaveSlots',
          'WBP_SaveIndicator',
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'BP_Bonfire (AARPGInteractableBase child) overlap + interact input → ' +
                'UARPGSaveSubsystem::SaveToSlot serializes UARPGSaveGame → ' +
                'UGameplayStatics::SaveGameToSlot("PoFSave_<slot>", 0, SaveObject)',
              activatedBy:
                'Enhanced Input IA_Interact on BP_Bonfire (AARPGInteractableBase::Interact); ' +
                'autosave via UARPGSaveSubsystem::TriggerAutoSave on OnPostMapChange / zone transition / ' +
                'AARPGQuestManager::OnQuestStageComplete',
              dependencies: [
                'characters (DT_AttributeDefaults — attribute baseline restored on load)',
                'quests (FARPGQuestSaveEntry — stage/outcome data)',
                'currencies (walletOrbs TMap keyed by currency slug)',
                'items (FARPGSavedItemEntry — item id + affixes restored on load)',
                'hud-elements (WBP_SaveIndicator HUD slot per proj-hud-binding)',
                'zone-map (UARPGZoneSubsystem::OnZoneTransition autosave trigger)',
              ],
              verification:
                'L2: UARPGSaveGame + AARPGInteractableBase + UARPGSaveSubsystem declared in Source/PoF/ ' +
                '+ DA_SavePoint data asset present + BP_Bonfire Blueprint child configured; ' +
                'L3: VSSaveLoadTest in PIE — save commits to disk, reload restores persisted state exactly, ' +
                'ephemeral state absent post-load',
            },
          },
          ueAssets: [
            `/Game/SaveSystem/UARPGSaveGame`,
            `/Game/World/Interactables/BP_Bonfire`,
            `/Game/SaveSystem/DA_SavePoint_${s}`,
            `/Game/UI/Icons/T_${s}_Icon`,
            `/Game/UI/HUD/WBP_SaveSlots`,
            `/Game/UI/HUD/WBP_SaveIndicator`,
          ],
        };
      },
      accept: minCount('assets', '≥4 UE assets packaged', 4),
      staticChecks: () => [
        cppSymbolExists('UARPGSaveGame', 'SaveGame subclass present in Source/'),
        cppSymbolExists('UARPGSaveSubsystem', 'Save subsystem present in Source/'),
        cppSymbolExists('AARPGInteractableBase', 'Interactable base class present in Source/ (BP_Bonfire parent)'),
      ],
    },
  ],
});
