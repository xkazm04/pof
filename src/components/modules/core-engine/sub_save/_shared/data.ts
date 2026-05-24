import {
  MODULE_COLORS, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_EMERALD,
  STATUS_INFO, STATUS_SUBDUED, ACCENT_VIOLET, ACCENT_PINK, STATUS_BLOCKER,
} from '@/lib/chart-colors';

/* ── Accent ──────────────────────────────────────────────────────────────── */
export const ACCENT = ACCENT_CYAN;

/* ── Schema Groups ───────────────────────────────────────────────────────── */

export type FieldType = 'int' | 'float' | 'string' | 'bool' | 'array' | 'object';
export interface SchemaField { name: string; type: FieldType; source: string; details?: string }
export interface SchemaGroup { id: string; label: string; color: string; fields: SchemaField[] }

export const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    id: 'character', label: 'SYS.CHAR_STATE', color: ACCENT_CYAN, fields: [
      { name: 'Level', type: 'int', source: 'arpg-progression', details: 'uint32 [0-100]' },
      { name: 'XP', type: 'int', source: 'arpg-progression', details: 'uint64 absolute' },
      { name: 'Position', type: 'object', source: 'arpg-character', details: 'FVector {X,Y,Z}' },
      { name: 'Attributes', type: 'object', source: 'arpg-gas', details: 'FGameplayAttributeData' },
      { name: 'ForceAlignment', type: 'float', source: 'arpg-character', details: 'float [-100..100] Light/Dark' },
      { name: 'LightsaberCrystalColor', type: 'string', source: 'arpg-inventory', details: 'FName crystal color ID' },
    ]
  },
  {
    id: 'inventory', label: 'SYS.INV_BLOB', color: MODULE_COLORS.content, fields: [
      { name: 'ItemInstances', type: 'array', source: 'arpg-inventory', details: 'TArray<FItemData>' },
      { name: 'EquippedItems', type: 'object', source: 'arpg-inventory', details: 'TMap<ESlot, FItem>' },
    ]
  },
  {
    id: 'progression', label: 'SYS.PROG_TREES', color: STATUS_SUCCESS, fields: [
      { name: 'UnlockedAbilities', type: 'array', source: 'arpg-gas', details: 'TArray<FName>' },
      { name: 'SpentPoints', type: 'int', source: 'arpg-progression', details: 'uint32 sum' },
      { name: 'ForcePoints', type: 'int', source: 'arpg-gas', details: 'uint32 [0-500]' },
      { name: 'ForcePowersLearned', type: 'array', source: 'arpg-gas', details: 'TArray<FGameplayTag>' },
    ]
  },
  {
    id: 'world', label: 'SYS.WORLD_STATE', color: MODULE_COLORS.systems, fields: [
      { name: 'VisitedZones', type: 'array', source: 'arpg-world', details: 'TSet<FName>' },
      { name: 'CompletedEncounters', type: 'array', source: 'arpg-world', details: 'Bitmask/TArray' },
      { name: 'LightsideChoices', type: 'int', source: 'arpg-world', details: 'uint16 count' },
      { name: 'DarksideChoices', type: 'int', source: 'arpg-world', details: 'uint16 count' },
    ]
  },
];

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

export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 'v1.0.0', label: 'V1.0', date: '2025-06-01', dateShort: '2025-06',
    author: 'Core Team', summary: 'Initial schema implementation',
    isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'Level', detail: 'uint32 character level [0-100]' },
      { type: 'added', field: 'XP', detail: 'uint64 absolute experience points' },
      { type: 'added', field: 'Position', detail: 'FVector world position' },
      { type: 'added', field: 'ItemInstances', detail: 'Raw binary inventory blob' },
    ]
  },
  {
    version: 'v1.1.0', label: 'V1.1', date: '2025-08-12', dateShort: '2025-08',
    author: 'Inventory Team', summary: 'Added EquippedItems serialization',
    isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'EquippedItems', detail: 'TMap<ESlot, FItem> for loadout persistence' },
      { type: 'added', field: 'Attributes', detail: 'FGameplayAttributeData serialization' },
      { type: 'modified', field: 'ItemInstances', detail: 'Raw bytes -> TArray<FItemData> structured' },
    ]
  },
  {
    version: 'v1.2.5', label: 'V1.2', date: '2025-10-03', dateShort: '2025-10',
    author: 'Save Systems', summary: 'Added Abilities & Encounter flags',
    isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'UnlockedAbilities', detail: 'TArray<FName> for ability tracking' },
      { type: 'added', field: 'SpentPoints', detail: 'uint32 sum of allocated skill points' },
      { type: 'added', field: 'VisitedZones', detail: 'TSet<FName> zone discovery tracking' },
      { type: 'removed', field: 'LegacySkillTree', detail: 'Replaced by GAS ability system' },
    ]
  },
  {
    version: 'v2.0.0', label: 'V2.0', date: '2026-01-15', dateShort: '2026-01',
    author: 'Engine Team', summary: 'Double-precision positions & encounter tracking',
    isCurrent: true, breaking: true,
    changes: [
      { type: 'modified', field: 'Position', detail: 'FVector -> FVector3d (double precision)' },
      { type: 'added', field: 'CompletedEncounters', detail: 'Bitmask array for encounter tracking' },
      { type: 'added', field: 'Checksum', detail: 'CRC32 integrity verification field' },
    ]
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
