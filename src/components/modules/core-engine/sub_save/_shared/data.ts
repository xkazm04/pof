import {
  MODULE_COLORS, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_EMERALD,
  STATUS_INFO, STATUS_SUBDUED, ACCENT_VIOLET, ACCENT_PINK, STATUS_BLOCKER,
} from '@/lib/chart-colors';
import {
  SAVE_PERSISTED_FIELDS, SAVE_VERSION_FIELD, SAVE_SCHEMA_VERSION, saveFieldNote,
  type SaveFieldGroup,
} from '@/lib/save-schema/fields';
import { ENHANCED_SLOTS } from './data-budget';

/* ── Accent ──────────────────────────────────────────────────────────────── */
export const ACCENT = ACCENT_CYAN;

/* ── Schema Groups ───────────────────────────────────────────────────────── */

export type FieldType = 'int' | 'float' | 'string' | 'bool' | 'array' | 'object';
export interface SchemaField { name: string; type: FieldType; source: string; details?: string }
export interface SchemaGroup { id: string; label: string; color: string; fields: SchemaField[] }

/** Tree-view type bucket for a UE declaration type. */
function fieldTypeOf(ueType: string): FieldType {
  if (ueType === 'int32') return 'int';
  if (ueType.startsWith('TArray<')) return 'array';
  if (ueType === 'FName' || ueType === 'FGameplayTag') return 'string';
  return 'object';
}

const GROUP_META: { id: SaveFieldGroup; label: string; color: string; source: string }[] = [
  { id: 'character', label: 'SYS.CHAR_STATE', color: ACCENT_CYAN, source: 'arpg-character' },
  { id: 'inventory', label: 'SYS.INV_BLOB', color: MODULE_COLORS.content, source: 'arpg-inventory' },
  { id: 'world', label: 'SYS.WORLD_STATE', color: MODULE_COLORS.systems, source: 'arpg-world' },
  { id: 'meta', label: 'SYS.SAVE_META', color: STATUS_SUCCESS, source: 'arpg-save' },
];

/** Every UPROPERTY UARPGSaveGame declares, from the one save-field authority (@/lib/save-schema/fields). */
const SAVE_GAME_FIELDS = [
  { ueName: SAVE_VERSION_FIELD.ueName, ueType: SAVE_VERSION_FIELD.ueType, group: SAVE_VERSION_FIELD.group, note: SAVE_VERSION_FIELD.note },
  ...SAVE_PERSISTED_FIELDS.map((f) => ({ ueName: f.ueName, ueType: f.ueType, group: f.group, note: saveFieldNote(f) })),
];

export const SCHEMA_GROUPS: SchemaGroup[] = GROUP_META.map(({ id, label, color, source }) => ({
  id, label, color,
  fields: SAVE_GAME_FIELDS.filter((f) => f.group === id).map((f) => ({
    name: f.ueName, type: fieldTypeOf(f.ueType), source, details: `${f.ueType} — ${f.note}`,
  })),
}));

export const TYPE_COLORS: Record<FieldType, string> = {
  int: STATUS_INFO, float: ACCENT_EMERALD, string: MODULE_COLORS.content,
  bool: ACCENT_VIOLET, array: ACCENT_PINK, object: STATUS_BLOCKER,
};

/* ── Save Slots (compact) ────────────────────────────────────────────────── */

export type SaveSlot = {
  id: string; label: string; isAuto: boolean; empty?: boolean;
  level?: number; zone?: string; playtime?: string; ts?: string; integrity?: string;
};

export const SAVE_SLOTS: SaveSlot[] = ENHANCED_SLOTS.map((s) => ({
  id: s.id, label: s.label, isAuto: s.isAuto, level: s.level,
  zone: s.zone, playtime: s.playtime, ts: s.lastPlayed, integrity: s.integrity,
}));

/* ── Schema Version History ──────────────────────────────────────────────── */

export interface SchemaVersionChange {
  type: 'added' | 'removed' | 'modified'; field: string; detail: string;
}

export interface SchemaVersion {
  version: string; label: string; date: string; dateShort: string;
  author: string; summary: string; isCurrent: boolean; breaking: boolean;
  changes: SchemaVersionChange[];
}

/**
 * The honest history: the save-points Versioning step ships v1 as the initial
 * schema (v0→v1, no migration). A SAVE_SCHEMA_VERSION bump adds an entry here
 * alongside its UARPGSaveSubsystem::MigrateSaveGame migration.
 */
export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: `v${SAVE_SCHEMA_VERSION}.0.0`, label: `V${SAVE_SCHEMA_VERSION}.0`, date: 'first shipped', dateShort: 'v0→v1',
    author: 'save-points State Schema', summary: 'Initial schema (no migration needed)',
    isCurrent: true, breaking: false,
    changes: SAVE_GAME_FIELDS.map((f) => ({ type: 'added' as const, field: f.ueName, detail: `${f.ueType} — ${f.note}` })),
  },
];

export const VERSIONS = SCHEMA_VERSIONS.map(v => ({ ver: v.version, diff: v.summary }));
export const SCHEMA_VERSION_HISTORY = [...SCHEMA_VERSIONS].reverse();

export const FEATURE_NAMES = [
  'UARPGSaveGame', 'Custom serialization', 'Save function',
  'Load function', 'Auto-save', 'Save slot system', 'Save versioning',
];

/* ── File Size Breakdown ─────────────────────────────────────────────────── */

export interface SizeSection {
  label: string; bytes: number; color: string;
  subsections?: { label: string; bytes: number }[];
}

function sizeSection(label: SaveFieldGroup, color: string, fields: [string, number][]): SizeSection {
  const subsections = fields.map(([l, bytes]) => ({ label: l, bytes }));
  return { label, color, bytes: subsections.reduce((t, x) => t + x.bytes, 0), subsections };
}

/**
 * Sections are the SaveFieldGroups of UARPGSaveGame and subsections are its real
 * fields. Byte figures are design-time ESTIMATES (no .sav reader exists yet); a
 * section total is always the sum of its fields so the two cannot disagree.
 */
export const FILE_SIZE_SECTIONS: SizeSection[] = [
  sizeSection('character', MODULE_COLORS.content, [
    ['PlayerLevel', 4], ['PlayerAttributes', 40], ['PassivePoints', 4], ['PassiveAllocations', 2048],
  ]),
  sizeSection('inventory', ACCENT_CYAN, [
    ['InventoryItems', 131072], ['WalletGold', 4], ['WalletOrbs', 512],
  ]),
  sizeSection('world', MODULE_COLORS.systems, [
    ['DefeatedEnemyTags', 8192], ['CompletedQuestStages', 4096], ['UnlockedZoneIds', 1024],
    ['CheckpointActorTag', 64], ['RepStandings', 512],
  ]),
  sizeSection('meta', STATUS_SUBDUED, [
    ['ActiveSaveSlot', 4], ['SaveTimestamp', 8], [SAVE_VERSION_FIELD.ueName, 4],
  ]),
];

export const TOTAL_BYTES = FILE_SIZE_SECTIONS.reduce((s, sec) => s + sec.bytes, 0);
export const COMPRESSION_RATIO = 0.62;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

/* ── Re-export split data modules for backward compat ────────────────────── */
export * from './data-budget';
// data-panels re-export removed to break circular dep (data-panels imports from ./data)
