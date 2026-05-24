import {
  MODULE_COLORS,
  ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { GaugeMetric } from '@/types/unique-tab-improvements';
import { SCHEMA_VERSIONS } from './data';

/* ── Integrity Validation ────────────────────────────────────────────────── */

export interface ValidationCheck {
  id: string; label: string; description: string;
  status: 'pass' | 'warn' | 'fail'; detail?: string;
}

export const VALIDATION_CHECKS: ValidationCheck[] = [
  { id: 'version', label: 'Version Compatible', description: 'Schema version matches engine version', status: 'pass', detail: 'v1.2.5 == v1.2.5' },
  { id: 'health', label: 'Health Range Valid', description: 'HP within attribute bounds [0, MaxHP]', status: 'pass', detail: '380 <= 420 (MaxHP)' },
  { id: 'level', label: 'Level In Bounds', description: 'Level within valid range [1-100]', status: 'pass', detail: 'Lv.14 in [1..100]' },
  { id: 'equipped', label: 'EquippedSlots Referential', description: 'All EquippedSlots GUIDs exist in ItemInstances', status: 'pass', detail: '6/6 GUIDs verified in ItemInstances' },
  { id: 'checksum', label: 'Checksum Valid', description: 'CRC32 integrity of save blob', status: 'pass', detail: '0xA3F7C201 == expected' },
  { id: 'orphan', label: 'No Orphan References', description: 'All FName references resolve', status: 'warn', detail: '1 stale quest ref (non-critical)' },
];

/* ── Migration Path ──────────────────────────────────────────────────────── */

export const MIGRATION_PATH = SCHEMA_VERSIONS.map(v => ({
  version: v.label,
  date: v.dateShort,
  fieldsAdded: v.changes.filter(c => c.type === 'added').map(c => c.field),
  fieldsRemoved: v.changes.filter(c => c.type === 'removed').map(c => c.field),
  fieldsModified: v.changes.filter(c => c.type === 'modified').map(c => `${c.field}: ${c.detail}`),
  breaking: v.breaking,
}));

export const COMPAT_MATRIX: { from: string; to: string; compat: 'full' | 'partial' | 'none' }[] = [
  { from: 'V1.0', to: 'V1.1', compat: 'full' },
  { from: 'V1.0', to: 'V1.2', compat: 'full' },
  { from: 'V1.0', to: 'V2.0', compat: 'partial' },
  { from: 'V1.1', to: 'V1.2', compat: 'full' },
  { from: 'V1.1', to: 'V2.0', compat: 'partial' },
  { from: 'V1.2', to: 'V2.0', compat: 'full' },
];

export const COMPAT_VERSIONS = MIGRATION_PATH.map(n => n.version);
export const COMPAT_LOOKUP = new Map(COMPAT_MATRIX.map(c => [`${c.from}->${c.to}`, c.compat]));

/* ── Cloud Sync ──────────────────────────────────────────────────────────── */

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'conflict' | 'offline';
  lastSync: string; conflicts: number; queueSize: number;
  bandwidthUsed: string; bandwidthLimit: string; provider: string; latency: number;
}

export const CLOUD_SYNC: SyncStatus = {
  status: 'synced', lastSync: '2026-02-26T14:32:08Z',
  conflicts: 0, queueSize: 0,
  bandwidthUsed: '1.2MB', bandwidthLimit: '50MB',
  provider: 'EOS Cloud', latency: 42,
};

/* ── Serialization Performance ───────────────────────────────────────────── */

export interface SerializationSegment {
  label: string; timeMs: number; color: string;
}

export const SERIALIZATION_SEGMENTS: SerializationSegment[] = [
  { label: 'PlayerData', timeMs: 12, color: ACCENT_CYAN },
  { label: 'Inventory', timeMs: 45, color: MODULE_COLORS.content },
  { label: 'WorldState', timeMs: 8, color: MODULE_COLORS.systems },
  { label: 'Settings', timeMs: 2, color: ACCENT_EMERALD },
];

export const SERIALIZATION_BUDGET_MS = 100;
export const SERIALIZATION_TOTAL = SERIALIZATION_SEGMENTS.reduce((s, seg) => s + seg.timeMs, 0);

export const PERF_METRICS: GaugeMetric[] = [
  { label: 'Serialize', current: SERIALIZATION_TOTAL, target: SERIALIZATION_BUDGET_MS, unit: 'ms', trend: 'stable' },
  { label: 'Deserialize', current: 54, target: SERIALIZATION_BUDGET_MS, unit: 'ms', trend: 'down' },
  { label: 'Compress', current: 18, target: 50, unit: 'ms', trend: 'stable' },
];

/* ── Auto-Save Config ────────────────────────────────────────────────────── */

export interface AutoSaveTrigger {
  id: string; label: string; enabled: boolean; description: string;
}

export const AUTO_SAVE_TRIGGERS: AutoSaveTrigger[] = [
  { id: 'zone', label: 'Zone Transition', enabled: true, description: 'Save when entering a new zone' },
  { id: 'boss', label: 'Boss Kill', enabled: true, description: 'Save after defeating a boss' },
  { id: 'quest', label: 'Quest Complete', enabled: true, description: 'Save on quest completion' },
  { id: 'timer', label: 'Timer Interval', enabled: true, description: 'Periodic auto-save on timer' },
  { id: 'levelup', label: 'Level Up', enabled: false, description: 'Save on character level up' },
  { id: 'merchant', label: 'Merchant Close', enabled: false, description: 'Save after closing merchant UI' },
];

export const AUTO_SAVE_CONFIG = {
  intervalSeconds: 120, maxAutoSaves: 5,
  combatSaveEnabled: false, compressionEnabled: true,
};

/* ── Data Recovery ───────────────────────────────────────────────────────── */

export type RecoveryStep = 'detect' | 'recover' | 'verify' | 'confirm';

export interface RecoveryResult {
  field: string; status: 'recovered' | 'partial' | 'lost';
  confidence: number; detail: string;
}

export const RECOVERY_STEPS: { id: RecoveryStep; label: string; icon: string }[] = [
  { id: 'detect', label: 'Detect', icon: 'scan' },
  { id: 'recover', label: 'Recover', icon: 'restore' },
  { id: 'verify', label: 'Verify', icon: 'check' },
  { id: 'confirm', label: 'Confirm', icon: 'done' },
];

export const RECOVERY_RESULTS: RecoveryResult[] = [
  { field: 'PlayerProgression', status: 'recovered', confidence: 98, detail: 'Full recovery from WAL journal' },
  { field: 'InventoryItems', status: 'recovered', confidence: 95, detail: 'Recovered from backup chunk' },
  { field: 'WorldState', status: 'partial', confidence: 72, detail: '3 encounter flags unrecoverable' },
  { field: 'Settings', status: 'recovered', confidence: 100, detail: 'Restored from defaults + delta' },
  { field: 'Metadata', status: 'lost', confidence: 0, detail: 'Corrupted beyond repair -- regenerated' },
];
