/**
 * The UARPGSaveGame field set — ONE authority for every consumer.
 *
 * Before this module the save field set was hand-written four times and no two
 * copies agreed (the save-points State Schema, the as-1 semantic verifier, the
 * as-1 CLI prompt that generates the class, and the Save tab's schema tree).
 * Every one of them now derives from the lists below:
 *
 * - `src/lib/catalog/pipelines/save-points.ts` — State Schema persisted/ephemeral
 *   lines + schemaVersion, Versioning currentVersion (output byte-identical to the
 *   hand-typed strings it replaced — stored artifacts and verdicts stay valid).
 * - `src/lib/checklist-expectations.ts` — as-1 expectedProperties.
 * - `src/lib/module-registry.ts` — the as-1 prompt's field list.
 * - `src/components/modules/core-engine/sub_save/_shared/data.ts` — SCHEMA_GROUPS
 *   and the schema version history.
 *
 * Canon (save-discrete-only / state-graph-fsm-wiring): persist only settled,
 * discrete mutations. Any change to SAVE_PERSISTED_FIELDS (add, remove, rename)
 * MUST bump SAVE_SCHEMA_VERSION and ship a migration in
 * UARPGSaveSubsystem::MigrateSaveGame.
 *
 * Pure data + renderers: no imports, safe on client and server.
 */

/** Current UARPGSaveGame::SchemaVersion. */
export const SAVE_SCHEMA_VERSION = 1;

/** The class every consumer names. */
export const SAVE_GAME_CLASS = 'UARPGSaveGame';

export type SaveFieldGroup = 'character' | 'inventory' | 'world' | 'meta';

export interface SaveField {
  /** camelCase key as the save-points State Schema writes it. */
  key: string;
  /** UPROPERTY name on UARPGSaveGame (PascalCase of `key`). */
  ueName: string;
  /** Type exactly as the save-points design doc spells it (`int`, `TMap<FName, int>`). */
  schemaType: string;
  /** C++ declaration type for the UPROPERTY (`int32`, `TMap<FName, int32>`). */
  ueType: string;
  group: SaveFieldGroup;
  /** Design note. `{checkpoint}` is replaced by the save point's entity slug. */
  note: string;
}

const CHECKPOINT_TOKEN = '{checkpoint}';

/** The version field — declared on UARPGSaveGame but not one of the persisted game-state fields. */
export const SAVE_VERSION_FIELD = {
  ueName: 'SchemaVersion',
  ueType: 'int32',
  group: 'meta' as SaveFieldGroup,
  note: `schema version (currently ${SAVE_SCHEMA_VERSION}); bumped by 1 for every persisted field-set change`,
};

type Row = [key: string, schemaType: string, group: SaveFieldGroup, note: string];

const ROWS: Row[] = [
  ['playerLevel', 'int', 'character', 'current character level (from DT_AttributeDefaults row)'],
  ['playerAttributes', 'FARPGAttributeSnapshot', 'character', 'base Str/Dex/Int/Life/Mana at save time (not in-combat derived values)'],
  ['inventoryItems', 'TArray<FARPGSavedItemEntry>', 'inventory', 'item id + affixes + socket state (from items catalog)'],
  ['walletGold', 'int', 'inventory', 'committed Gold balance (UARPGWalletComponent::GetGold at save time)'],
  ['walletOrbs', 'TMap<FName, int>', 'inventory', 'orb currency counts keyed by currency entity slug'],
  ['defeatedEnemyTags', 'TArray<FGameplayTag>', 'world', 'each State.Enemy.Defeated.<EnemyId> that has fired'],
  ['completedQuestStages', 'TArray<FARPGQuestSaveEntry>', 'world', '{questId, stageIndex, outcome} for each terminal stage reached'],
  ['unlockedZoneIds', 'TArray<FName>', 'world', 'zone catalog ids the player has entered at least once'],
  ['checkpointActorTag', 'FGameplayTag', 'world', `the State.Checkpoint.${CHECKPOINT_TOKEN} tag marking this checkpoint activated`],
  ['repStandings', 'TMap<FName, int>', 'world', 'faction reputation points keyed by faction catalog id'],
  ['passivePoints', 'int', 'character', 'total passive points spent'],
  ['passiveAllocations', 'TArray<FName>', 'character', 'node ids of allocated passive tree nodes'],
  ['activeSaveSlot', 'int', 'meta', '0-indexed slot this save occupies (0–2)'],
  ['saveTimestamp', 'FDateTime', 'meta', 'wall-clock time of last save'],
];

/** Design-doc `int` is `int32` on the UE side; every other type is already a UE type. */
const toUeType = (schemaType: string) => schemaType.replace(/\bint\b/g, 'int32');
const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The 14 persisted UARPGSaveGame fields, in schema order. */
export const SAVE_PERSISTED_FIELDS: readonly SaveField[] = ROWS.map(([key, schemaType, group, note]) => ({
  key,
  ueName: pascal(key),
  schemaType,
  ueType: toUeType(schemaType),
  group,
  note,
}));

/** State that is intentionally ABSENT from UARPGSaveGame (rebuilt on load). */
export const SAVE_EPHEMERAL_FIELDS: readonly { key: string; note: string }[] = [
  { key: 'currentAIStateTags', note: 'blackboard keys + running State.AI.* tags on all actors' },
  { key: 'inFlightGASEffects', note: 'active GE handles on the player (re-derived from saved attributes on respawn)' },
  { key: 'pendingSpawnPool', note: 'enemy actors spawned but not yet defeated (re-derived from defeatedEnemyTags)' },
  { key: 'navigationMeshCache', note: 'rebuilt by NavMesh on load' },
  { key: 'physicsSimState', note: 'Chaos physics body transforms (reset to blueprint defaults)' },
  { key: 'activeLevelStreaming', note: 'async-loaded sublevel states (re-streamed on zone restore)' },
  { key: 'currentCombatTarget', note: 'cleared on session end' },
  { key: 'unsettledCurrencyDrops', note: 'items mid-air on death that were never picked up' },
];

/** A field's note with the checkpoint token resolved (generic `<Checkpoint>` by default). */
export function saveFieldNote(field: SaveField, checkpointSlug = '<Checkpoint>'): string {
  return field.note.split(CHECKPOINT_TOKEN).join(checkpointSlug);
}

/** The save-points State Schema persisted lines: `key: type — note`. */
export function persistedFieldLines(checkpointSlug: string): string[] {
  return SAVE_PERSISTED_FIELDS.map((f) => `${f.key}: ${f.schemaType} — ${saveFieldNote(f, checkpointSlug)}`);
}

/** The save-points State Schema ephemeral lines: `key — note`. */
export function ephemeralFieldLines(): string[] {
  return SAVE_EPHEMERAL_FIELDS.map((f) => `${f.key} — ${f.note}`);
}

/** Every UPROPERTY name UARPGSaveGame must declare: SchemaVersion + the persisted fields. */
export function saveGamePropertyNames(): string[] {
  return [SAVE_VERSION_FIELD.ueName, ...SAVE_PERSISTED_FIELDS.map((f) => f.ueName)];
}

/** Prompt-ready declaration list: `int32 PlayerLevel — current character level ...`. */
export function saveGamePropertyDeclarations(): string[] {
  return SAVE_PERSISTED_FIELDS.map((f) => `${f.ueType} ${f.ueName} — ${saveFieldNote(f)}`);
}
