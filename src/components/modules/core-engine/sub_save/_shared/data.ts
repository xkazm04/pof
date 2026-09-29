import {
  MODULE_COLORS, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_EMERALD,
  STATUS_INFO, STATUS_SUBDUED, ACCENT_VIOLET, ACCENT_PINK, STATUS_BLOCKER,
} from '@/lib/chart-colors';
import {
  SAVE_PERSISTED_FIELDS, SAVE_VERSION_FIELD, SAVE_SCHEMA_VERSION, saveFieldNote,
  type SaveFieldGroup,
} from '@/lib/save-schema/fields';

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

export const SAVE_SLOTS: SaveSlot[] = [
  { id: 'auto', label: 'AUTO_SAVE', isAuto: true, level: 14, zone: 'The Ashlands', playtime: '4h 28m', ts: '8m ago', integrity: '100%' },
  { id: 'slot-1', label: 'SLOT-01', isAuto: false, level: 14, zone: 'The Ashlands', playtime: '4h 32m', ts: '2h ago', integrity: '100%' },
  { id: 'slot-2', label: 'SLOT-02', isAuto: false, level: 7, zone: 'Verdant Plains', playtime: '1h 58m', ts: '1d ago', integrity: '98%' },
  { id: 'slot-3', label: 'SLOT-03', isAuto: false, level: 1, zone: 'Tutorial Zone', playtime: '0h 12m', ts: '3d ago', integrity: '100%' },
  { id: 'slot-4', label: 'SLOT-04', isAuto: false, empty: true },
];

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

export const FILE_SIZE_SECTIONS: SizeSection[] = [
  { label: 'InventoryItems', bytes: 131072, color: MODULE_COLORS.content, subsections: [
    { label: 'ItemInstances', bytes: 98304 },
    { label: 'EquippedSlots', bytes: 24576 },
    { label: 'Stash', bytes: 8192 },
  ]},
  { label: 'PlayerProgression', bytes: 46080, color: ACCENT_CYAN, subsections: [
    { label: 'Level/XP', bytes: 8192 },
    { label: 'Attributes', bytes: 16384 },
    { label: 'AbilityTree', bytes: 21504 },
  ]},
  { label: 'WorldState', bytes: 32768, color: MODULE_COLORS.systems, subsections: [
    { label: 'VisitedZones', bytes: 16384 },
    { label: 'Encounters', bytes: 12288 },
    { label: 'NPCStates', bytes: 4096 },
  ]},
  { label: 'Settings', bytes: 8192, color: ACCENT_EMERALD },
  { label: 'Metadata', bytes: 4096, color: STATUS_SUBDUED },
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
