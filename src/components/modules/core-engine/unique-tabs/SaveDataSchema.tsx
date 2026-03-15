'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import {
  Save, ChevronDown, ChevronRight, Database, Terminal, Cpu,
  HardDrive, FileText, ShieldCheck, GitBranch, Cloud, Layers,
  Timer, Settings, History, Wrench, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Download, Upload, Copy, Trash2, Play,
  Zap, Lock, Wifi, WifiOff, Archive, RotateCcw, Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, OPACITY_8, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow } from '@/types/feature-matrix';
import type { DiffEntry, BudgetBar, GaugeMetric } from '@/types/unique-tab-improvements';
import { TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner, DiffViewer, LiveMetricGauge } from './_shared';

const ACCENT = ACCENT_CYAN;

type FieldType = 'int' | 'float' | 'string' | 'bool' | 'array' | 'object';
interface SchemaField { name: string; type: FieldType; source: string; details?: string }
interface SchemaGroup { id: string; label: string; color: string; fields: SchemaField[] }

const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    id: 'character', label: 'SYS.CHAR_STATE', color: ACCENT_CYAN, fields: [
      { name: 'Level', type: 'int', source: 'arpg-progression', details: 'uint32 [0-100]' },
      { name: 'XP', type: 'int', source: 'arpg-progression', details: 'uint64 absolute' },
      { name: 'Position', type: 'object', source: 'arpg-character', details: 'FVector {X,Y,Z}' },
      { name: 'Attributes', type: 'object', source: 'arpg-gas', details: 'FGameplayAttributeData' },
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
    ]
  },
  {
    id: 'world', label: 'SYS.WORLD_STATE', color: MODULE_COLORS.systems, fields: [
      { name: 'VisitedZones', type: 'array', source: 'arpg-world', details: 'TSet<FName>' },
      { name: 'CompletedEncounters', type: 'array', source: 'arpg-world', details: 'Bitmask/TArray' },
    ]
  },
];

const TYPE_COLORS: Record<FieldType, string> = {
  int: '#60a5fa', float: '#34d399', string: '#f59e0b',
  bool: '#a78bfa', array: '#f472b6', object: '#fb923c',
};

type SaveSlot = {
  id: string;
  label: string;
  isAuto: boolean;
  empty?: boolean;
  level?: number;
  zone?: string;
  playtime?: string;
  ts?: string;
  integrity?: string;
};

const SAVE_SLOTS: SaveSlot[] = [
  { id: 'auto', label: 'AUTO_SAVE', isAuto: true, level: 14, zone: 'The Ashlands', playtime: '4h 28m', ts: '8m ago', integrity: '100%' },
  { id: 'slot-1', label: 'SLOT-01', isAuto: false, level: 14, zone: 'The Ashlands', playtime: '4h 32m', ts: '2h ago', integrity: '100%' },
  { id: 'slot-2', label: 'SLOT-02', isAuto: false, level: 7, zone: 'Verdant Plains', playtime: '1h 58m', ts: '1d ago', integrity: '98%' },
  { id: 'slot-3', label: 'SLOT-03', isAuto: false, level: 1, zone: 'Tutorial Zone', playtime: '0h 12m', ts: '3d ago', integrity: '100%' },
  { id: 'slot-4', label: 'SLOT-04', isAuto: false, empty: true },
];

const VERSIONS = [
  { ver: 'v1.0.0', diff: 'Initial schema implementation' },
  { ver: 'v1.1.0', diff: 'Added EquippedItems serialization' },
  { ver: 'v1.2.5', diff: 'Added Abilities & Encounter flags' },
];

const FEATURE_NAMES = [
  'UARPGSaveGame', 'Custom serialization', 'Save function',
  'Load function', 'Auto-save', 'Save slot system', 'Save versioning',
];

/* ── 11.1 Save File Size Breakdown Data ──────────────────────────────────── */

interface SizeSection {
  label: string;
  bytes: number;
  color: string;
  subsections?: { label: string; bytes: number }[];
}

const FILE_SIZE_SECTIONS: SizeSection[] = [
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
  { label: 'Metadata', bytes: 4096, color: '#64748b' },
];

const TOTAL_BYTES = FILE_SIZE_SECTIONS.reduce((s, sec) => s + sec.bytes, 0);
const COMPRESSION_RATIO = 0.62;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

/* ── 11.2 Save Data Diff Entries ─────────────────────────────────────────── */

const SAVE_DIFF_ENTRIES: DiffEntry[] = [
  { field: 'Level', oldValue: 13, newValue: 14, changeType: 'changed' },
  { field: 'XP', oldValue: 4200, newValue: 5100, changeType: 'changed' },
  { field: 'CurrentZone', oldValue: 'Verdant Plains', newValue: 'The Ashlands', changeType: 'changed' },
  { field: 'Health', oldValue: 340, newValue: 380, changeType: 'changed' },
  { field: 'SteelSword', oldValue: '', newValue: 'Steel Sword +2', changeType: 'added' },
  { field: 'AshlandsVisited', oldValue: '', newValue: 'true', changeType: 'added' },
  { field: 'OldTutorialFlag', oldValue: 'skip_intro', newValue: '', changeType: 'removed' },
  { field: 'GoldAmount', oldValue: 1250, newValue: 1250, changeType: 'unchanged' },
];

/* ── 11.3 Save Integrity Validator Data ──────────────────────────────────── */

interface ValidationCheck {
  id: string;
  label: string;
  description: string;
  status: 'pass' | 'warn' | 'fail';
  detail?: string;
}

const VALIDATION_CHECKS: ValidationCheck[] = [
  { id: 'version', label: 'Version Compatible', description: 'Schema version matches engine version', status: 'pass', detail: 'v1.2.5 == v1.2.5' },
  { id: 'health', label: 'Health Range Valid', description: 'HP within attribute bounds [0, MaxHP]', status: 'pass', detail: '380 <= 420 (MaxHP)' },
  { id: 'level', label: 'Level In Bounds', description: 'Level within valid range [1-100]', status: 'pass', detail: 'Lv.14 in [1..100]' },
  { id: 'equipped', label: 'Equipped Items Exist', description: 'All equipped items found in inventory', status: 'pass', detail: '6/6 items verified' },
  { id: 'checksum', label: 'Checksum Valid', description: 'CRC32 integrity of save blob', status: 'pass', detail: '0xA3F7C201 == expected' },
  { id: 'orphan', label: 'No Orphan References', description: 'All FName references resolve', status: 'warn', detail: '1 stale quest ref (non-critical)' },
];

/* ── 11.4 Migration Path Visualizer Data ─────────────────────────────────── */

interface MigrationNode {
  version: string;
  date: string;
  fieldsAdded: string[];
  fieldsRemoved: string[];
  fieldsModified: string[];
  breaking: boolean;
}

const MIGRATION_PATH: MigrationNode[] = [
  { version: 'V1.0', date: '2025-06', fieldsAdded: ['Level', 'XP', 'Position', 'ItemInstances'], fieldsRemoved: [], fieldsModified: [], breaking: false },
  { version: 'V1.1', date: '2025-08', fieldsAdded: ['EquippedItems', 'Attributes'], fieldsRemoved: [], fieldsModified: ['ItemInstances → TArray<FItemData>'], breaking: false },
  { version: 'V1.2', date: '2025-10', fieldsAdded: ['UnlockedAbilities', 'SpentPoints', 'VisitedZones'], fieldsRemoved: ['LegacySkillTree'], fieldsModified: [], breaking: false },
  { version: 'V2.0', date: '2026-01', fieldsAdded: ['CompletedEncounters', 'Checksum'], fieldsRemoved: [], fieldsModified: ['Position → FVector3d'], breaking: true },
];

const COMPAT_MATRIX: { from: string; to: string; compat: 'full' | 'partial' | 'none' }[] = [
  { from: 'V1.0', to: 'V1.1', compat: 'full' },
  { from: 'V1.0', to: 'V1.2', compat: 'full' },
  { from: 'V1.0', to: 'V2.0', compat: 'partial' },
  { from: 'V1.1', to: 'V1.2', compat: 'full' },
  { from: 'V1.1', to: 'V2.0', compat: 'partial' },
  { from: 'V1.2', to: 'V2.0', compat: 'full' },
];

/* ── 11.5 Cloud Save Sync Status Data ────────────────────────────────────── */

interface SyncStatus {
  status: 'synced' | 'syncing' | 'conflict' | 'offline';
  lastSync: string;
  conflicts: number;
  queueSize: number;
  bandwidthUsed: string;
  bandwidthLimit: string;
  provider: string;
  latency: number;
}

const CLOUD_SYNC: SyncStatus = {
  status: 'synced',
  lastSync: '2026-02-26T14:32:08Z',
  conflicts: 0,
  queueSize: 0,
  bandwidthUsed: '1.2MB',
  bandwidthLimit: '50MB',
  provider: 'EOS Cloud',
  latency: 42,
};

/* ── 11.6 Save Slot Management (Enhanced) ────────────────────────────────── */

interface EnhancedSlot {
  id: string;
  label: string;
  isAuto: boolean;
  characterName: string;
  className: string;
  level: number;
  zone: string;
  playtime: string;
  lastPlayed: string;
  fileSize: string;
  integrity: string;
  screenshotPlaceholder: string;
}

const ENHANCED_SLOTS: EnhancedSlot[] = [
  { id: 'auto', label: 'AUTO_SAVE', isAuto: true, characterName: 'Kael', className: 'Battlemage', level: 14, zone: 'The Ashlands', playtime: '4h 28m', lastPlayed: '8 min ago', fileSize: '217KB', integrity: '100%', screenshotPlaceholder: 'Ashlands Overlook' },
  { id: 'slot-1', label: 'SLOT-01', isAuto: false, characterName: 'Kael', className: 'Battlemage', level: 14, zone: 'The Ashlands', playtime: '4h 32m', lastPlayed: '2 hours ago', fileSize: '215KB', integrity: '100%', screenshotPlaceholder: 'Boss Arena Gate' },
  { id: 'slot-2', label: 'SLOT-02', isAuto: false, characterName: 'Lyra', className: 'Ranger', level: 7, zone: 'Verdant Plains', playtime: '1h 58m', lastPlayed: '1 day ago', fileSize: '142KB', integrity: '98%', screenshotPlaceholder: 'Plains Campfire' },
  { id: 'slot-3', label: 'SLOT-03', isAuto: false, characterName: 'Gorath', className: 'Berserker', level: 1, zone: 'Tutorial Zone', playtime: '0h 12m', lastPlayed: '3 days ago', fileSize: '48KB', integrity: '100%', screenshotPlaceholder: 'Starting Village' },
];

/* ── 11.7 Serialization Performance Data ─────────────────────────────────── */

interface SerializationSegment {
  label: string;
  timeMs: number;
  color: string;
}

const SERIALIZATION_SEGMENTS: SerializationSegment[] = [
  { label: 'PlayerData', timeMs: 12, color: ACCENT_CYAN },
  { label: 'Inventory', timeMs: 45, color: MODULE_COLORS.content },
  { label: 'WorldState', timeMs: 8, color: MODULE_COLORS.systems },
  { label: 'Settings', timeMs: 2, color: ACCENT_EMERALD },
];

const SERIALIZATION_BUDGET_MS = 100;
const SERIALIZATION_TOTAL = SERIALIZATION_SEGMENTS.reduce((s, seg) => s + seg.timeMs, 0);

const PERF_METRICS: GaugeMetric[] = [
  { label: 'Serialize', current: SERIALIZATION_TOTAL, target: SERIALIZATION_BUDGET_MS, unit: 'ms', trend: 'stable' },
  { label: 'Deserialize', current: 54, target: SERIALIZATION_BUDGET_MS, unit: 'ms', trend: 'down' },
  { label: 'Compress', current: 18, target: 50, unit: 'ms', trend: 'stable' },
];

/* ── 11.8 Auto-Save Configuration Data ───────────────────────────────────── */

interface AutoSaveTrigger {
  id: string;
  label: string;
  enabled: boolean;
  description: string;
}

const AUTO_SAVE_TRIGGERS: AutoSaveTrigger[] = [
  { id: 'zone', label: 'Zone Transition', enabled: true, description: 'Save when entering a new zone' },
  { id: 'boss', label: 'Boss Kill', enabled: true, description: 'Save after defeating a boss' },
  { id: 'quest', label: 'Quest Complete', enabled: true, description: 'Save on quest completion' },
  { id: 'timer', label: 'Timer Interval', enabled: true, description: 'Periodic auto-save on timer' },
  { id: 'levelup', label: 'Level Up', enabled: false, description: 'Save on character level up' },
  { id: 'merchant', label: 'Merchant Close', enabled: false, description: 'Save after closing merchant UI' },
];

const AUTO_SAVE_CONFIG = {
  intervalSeconds: 120,
  maxAutoSaves: 5,
  combatSaveEnabled: false,
  compressionEnabled: true,
};

/* ── 11.9 Schema Version History Data ────────────────────────────────────── */

interface SchemaVersionEntry {
  version: string;
  date: string;
  author: string;
  isCurrent: boolean;
  breaking: boolean;
  changes: { type: 'added' | 'removed' | 'modified'; field: string; detail: string }[];
}

const SCHEMA_VERSION_HISTORY: SchemaVersionEntry[] = [
  {
    version: 'v2.0.0', date: '2026-01-15', author: 'Engine Team', isCurrent: true, breaking: true,
    changes: [
      { type: 'modified', field: 'Position', detail: 'FVector → FVector3d (double precision)' },
      { type: 'added', field: 'CompletedEncounters', detail: 'Bitmask array for encounter tracking' },
      { type: 'added', field: 'Checksum', detail: 'CRC32 integrity verification field' },
    ]
  },
  {
    version: 'v1.2.5', date: '2025-10-03', author: 'Save Systems', isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'UnlockedAbilities', detail: 'TArray<FName> for ability tracking' },
      { type: 'added', field: 'SpentPoints', detail: 'uint32 sum of allocated skill points' },
      { type: 'added', field: 'VisitedZones', detail: 'TSet<FName> zone discovery tracking' },
      { type: 'removed', field: 'LegacySkillTree', detail: 'Replaced by GAS ability system' },
    ]
  },
  {
    version: 'v1.1.0', date: '2025-08-12', author: 'Inventory Team', isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'EquippedItems', detail: 'TMap<ESlot, FItem> for loadout persistence' },
      { type: 'added', field: 'Attributes', detail: 'FGameplayAttributeData serialization' },
      { type: 'modified', field: 'ItemInstances', detail: 'Raw bytes → TArray<FItemData> structured' },
    ]
  },
  {
    version: 'v1.0.0', date: '2025-06-01', author: 'Core Team', isCurrent: false, breaking: false,
    changes: [
      { type: 'added', field: 'Level', detail: 'uint32 character level [0-100]' },
      { type: 'added', field: 'XP', detail: 'uint64 absolute experience points' },
      { type: 'added', field: 'Position', detail: 'FVector world position' },
      { type: 'added', field: 'ItemInstances', detail: 'Raw binary inventory blob' },
    ]
  },
];

/* ── 11.10 Data Recovery Tool Data ───────────────────────────────────────── */

type RecoveryStep = 'detect' | 'recover' | 'verify' | 'confirm';

interface RecoveryResult {
  field: string;
  status: 'recovered' | 'partial' | 'lost';
  confidence: number;
  detail: string;
}

const RECOVERY_STEPS: { id: RecoveryStep; label: string; icon: string }[] = [
  { id: 'detect', label: 'Detect', icon: 'scan' },
  { id: 'recover', label: 'Recover', icon: 'restore' },
  { id: 'verify', label: 'Verify', icon: 'check' },
  { id: 'confirm', label: 'Confirm', icon: 'done' },
];

const RECOVERY_RESULTS: RecoveryResult[] = [
  { field: 'PlayerProgression', status: 'recovered', confidence: 98, detail: 'Full recovery from WAL journal' },
  { field: 'InventoryItems', status: 'recovered', confidence: 95, detail: 'Recovered from backup chunk' },
  { field: 'WorldState', status: 'partial', confidence: 72, detail: '3 encounter flags unrecoverable' },
  { field: 'Settings', status: 'recovered', confidence: 100, detail: 'Restored from defaults + delta' },
  { field: 'Metadata', status: 'lost', confidence: 0, detail: 'Corrupted beyond repair — regenerated' },
];

/* ═══════════════════════════════════════════════════════════════════════════ */

interface SaveDataSchemaProps { moduleId: SubModuleId }

export function SaveDataSchema({ moduleId }: SaveDataSchemaProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['character', 'inventory']));
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Blinking cursor effect — pauses when module is suspended
  const [cursorVisible, setCursorVisible] = useState(true);
  useSuspendableEffect(() => {
    const i = setInterval(() => setCursorVisible(v => !v), 500);
    return () => clearInterval(i);
  }, []);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const treeRef = useRef<HTMLDivElement>(null);

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const tree = treeRef.current;
    if (!tree) return;
    const focusable = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const current = document.activeElement as HTMLElement;
    const idx = focusable.indexOf(current);
    if (idx === -1) return;

    let next: HTMLElement | undefined;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        next = focusable[idx + 1];
        break;
      case 'ArrowUp':
        e.preventDefault();
        next = focusable[idx - 1];
        break;
      case 'ArrowRight': {
        e.preventDefault();
        const groupId = current.dataset.groupId;
        if (groupId && !expandedGroups.has(groupId)) {
          toggleGroup(groupId);
        } else {
          next = focusable[idx + 1];
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const groupId = current.dataset.groupId;
        if (groupId && expandedGroups.has(groupId)) {
          toggleGroup(groupId);
        } else if (!groupId) {
          // Focus parent group button
          for (let i = idx - 1; i >= 0; i--) {
            if (focusable[i].dataset.groupId) { next = focusable[i]; break; }
          }
        }
        break;
      }
      case 'Home':
        e.preventDefault();
        next = focusable[0];
        break;
      case 'End':
        e.preventDefault();
        next = focusable[focusable.length - 1];
        break;
      default:
        return;
    }
    next?.focus();
  }, [expandedGroups, toggleGroup]);

  const stats = useMemo(() => {
    const implemented = FEATURE_NAMES.filter((n) => {
      const st = featureMap.get(n)?.status ?? 'unknown';
      return st === 'implemented' || st === 'improved';
    }).length;
    return { total: FEATURE_NAMES.length, implemented };
  }, [featureMap]);

  /* ── State for new sections ──────────────────────────────────────────── */
  const [expandedVersion, setExpandedVersion] = useState<string | null>('v2.0.0');
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('confirm');
  const [expandedMigration, setExpandedMigration] = useState<string | null>('V2.0');

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  const overallValidation = VALIDATION_CHECKS.every(c => c.status === 'pass') ? 'PASS' :
    VALIDATION_CHECKS.some(c => c.status === 'fail') ? 'FAIL' : 'WARN';

  const recoveryOverall = RECOVERY_RESULTS.reduce((sum, r) => sum + r.confidence, 0) / RECOVERY_RESULTS.length;

  return (
    <div className="space-y-2.5">
      {/* Terminal Interface Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-900/40 relative">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded grid place-items-center bg-cyan-950/50 border border-cyan-800/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-500/20 animate-pulse pointer-events-none" style={{ animationDuration: '2s' }} />
            <Terminal className="w-5 h-5 relative z-10 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-cyan-100 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(34,211,238,0.4)' }}>
              Save.Data_Schema <span className="text-cyan-400">{cursorVisible ? '_' : ' '}</span>
            </span>
            <span className="text-xs text-cyan-700 font-mono uppercase tracking-widest mt-0.5">
              Protocol: UARPG_SYS_{stats.implemented}/{stats.total}
            </span>
          </div>
        </div>
      </div>

      {/* Cyber Flow diagram */}
      <SurfaceCard level={2} className="p-3 border-cyan-900/30 bg-black/40 shadow-inner relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }} />
        <div className="flex items-center gap-2 mb-2.5 text-cyan-500/70 font-mono text-xs uppercase tracking-widest border-b border-cyan-900/40 pb-2">
          <Cpu className="w-4 h-4" /> Runtime Serialization Pipeline
        </div>
        <div className="relative z-10">
          <PipelineFlow steps={['Gather State', 'Serialize', 'SaveGame Object', 'Deserialize', 'Restore State']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Schema tree terminal view */}
        <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex flex-col h-full overflow-hidden relative">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

          <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center justify-between bg-cyan-950/10">
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">DATA_STRUCTURE.h</span>
            <span className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-red-500/50" />
              <span className="w-2 h-2 rounded-full bg-amber-500/50" />
              <span className="w-2 h-2 rounded-full bg-green-500/50" />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-1.5 bg-cyan-950/20 border-b border-cyan-900/20 text-[10px] font-mono">
            {(Object.entries(TYPE_COLORS) as [FieldType, string][]).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }} className="uppercase">{type}</span>
              </span>
            ))}
          </div>

          <div className="p-4 space-y-1 font-mono text-xs leading-relaxed overflow-y-auto custom-scrollbar relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-cyan-950/20 border-r border-cyan-900/20 z-0 select-none flex flex-col pt-4 items-center text-[10px] text-cyan-800/40 font-mono">
              {[...Array(20)].map((_, i) => <div key={i} className="h-6 flex items-center">{i + 1}</div>)}
            </div>

            <div className="relative z-10 pl-6 text-cyan-500/80" ref={treeRef} role="tree" aria-label="Save data schema tree" onKeyDown={handleTreeKeyDown}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
                <span className="text-purple-400">struct</span> <span className="text-emerald-400">USaveDataSchema</span> {'{'}
              </motion.div>

              <div className="pl-4 mt-1 border-l border-cyan-900/30">
                {SCHEMA_GROUPS.map((group, groupIndex) => {
                  const isOpen = expandedGroups.has(group.id);
                  return (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * groupIndex }}
                      className="mb-1"
                    >
                      <button
                        role="treeitem"
                        aria-expanded={isOpen}
                        aria-label={`${group.label} group, ${group.fields.length} fields`}
                        data-group-id={group.id}
                        tabIndex={groupIndex === 0 ? 0 : -1}
                        onClick={() => toggleGroup(group.id)}
                        className="flex items-center gap-2 hover:bg-cyan-900/20 px-2 py-0.5 rounded transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
                      >
                        <span className="text-cyan-700">{isOpen ? '▼' : '▶'}</span>
                        <span style={{ color: group.color, textShadow: `0 0 5px ${group.color}40` }}>{group.label}</span>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            role="group"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pl-6"
                          >
                            {group.fields.map((field) => (
                              <div
                                key={field.name}
                                role="treeitem"
                                tabIndex={-1}
                                aria-label={`${field.name}, type ${field.type}`}
                                className="flex gap-2.5 py-0.5 hover:bg-white/5 pr-2 group transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded"
                              >
                                <span className="w-[80px] shrink-0 font-medium" style={{ color: TYPE_COLORS[field.type] }}>{field.type}</span>
                                <span className="text-cyan-100">{field.name};</span>
                                <span className="text-cyan-700/60 ml-auto hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">// {field.details}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-1 text-cyan-500/80">{'};'}</div>
            </div>

            <div className="pl-6 mt-2.5 text-cyan-500/40">
              &gt; EOF
            </div>
          </div>
        </SurfaceCard>

        {/* Save Slots matrix style */}
        <div className="space-y-2.5 h-full flex flex-col">
          <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] flex-1 flex flex-col overflow-hidden relative">
            <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
              <Database className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">MEMORY_BANKS</span>
            </div>

            <div className="p-4 space-y-3 relative z-10 flex-1 overflow-y-auto">
              {SAVE_SLOTS.map((slot, i) => (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className={`font-mono p-3 relative overflow-hidden group transition-colors ${
                    slot.empty
                      ? 'border border-dashed border-cyan-800/30 bg-cyan-950/5'
                      : `border ${slot.isAuto ? 'border-amber-500/30 bg-amber-950/10' : 'border-cyan-900/40 bg-cyan-950/20'} hover:border-cyan-500`
                  }`}
                >
                  {slot.empty ? (
                    <div className="flex flex-col items-center justify-center py-3 gap-2">
                      <div className="w-8 h-8 rounded-full border border-dashed border-cyan-800/40 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-cyan-700" />
                      </div>
                      <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-widest">{slot.label}</span>
                      <span className="text-[10px] text-cyan-600/60">New Save</span>
                    </div>
                  ) : (
                    <>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${slot.isAuto ? 'bg-amber-500' : 'bg-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity'}`} />

                      <div className="flex justify-between items-start mb-2 pl-2">
                        <span className={`text-xs font-bold tracking-widest ${slot.isAuto ? 'text-amber-400' : 'text-cyan-300'}`}>{slot.label}</span>
                        <span className="text-[10px] text-cyan-700">{slot.ts}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-1.5 text-xs pl-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-cyan-700 uppercase">Location</span>
                          <span className="text-cyan-100 truncate pr-2">{slot.zone}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-cyan-700 uppercase">Integrity</span>
                          <span className="text-emerald-400">{slot.integrity}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-cyan-700 uppercase">Level</span>
                          <span className="text-cyan-100">Lv.{slot.level!.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-cyan-700 uppercase">Uptime</span>
                          <span className="text-cyan-100">{slot.playtime}</span>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Migration chain terminal log */}
      <SurfaceCard level={2} className="p-3 border-cyan-900/30 bg-[#060b11] font-mono relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3 border-b border-cyan-900/40 pb-2">
          <Database className="w-3.5 h-3.5 text-cyan-600" />
          <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">MIGRATION_HISTORY.log</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {VERSIONS.map((v, i, arr) => (
            <motion.div
              key={v.ver}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex flex-col bg-cyan-950/30 border border-cyan-900/50 px-3 py-2 text-xs relative group hover:border-cyan-500/50 transition-colors">
                <span className="text-cyan-300 font-bold">{v.ver}</span>
                <span className="text-[10px] text-cyan-700 mt-1">{v.diff}</span>
                {/* Scanline hover effect */}
                <div className="absolute left-0 right-0 h-px bg-cyan-400/50 top-0 bottom-auto opacity-0 group-hover:opacity-100 group-hover:animate-[scanline_1s_ease-in-out_infinite]" />
              </div>
              {i < arr.length - 1 && <span className="text-cyan-800 text-sm">--&gt;</span>}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.1 — Save File Size Breakdown                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }} />
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <HardDrive className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">FILE_SIZE_BREAKDOWN</span>
          <span className="ml-auto text-[10px] font-mono text-cyan-700">{formatBytes(TOTAL_BYTES)} total</span>
        </div>

        <div className="p-4 space-y-2.5 relative z-10">
          {/* Treemap-style rectangles */}
          <div className="flex gap-1 h-16 rounded overflow-hidden">
            {FILE_SIZE_SECTIONS.map((sec) => {
              const pct = (sec.bytes / TOTAL_BYTES) * 100;
              return (
                <motion.div
                  key={sec.label}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="relative group cursor-default overflow-hidden"
                  style={{ backgroundColor: `${sec.color}30`, borderLeft: `2px solid ${sec.color}` }}
                  title={`${sec.label}: ${formatBytes(sec.bytes)} (${pct.toFixed(1)}%)`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: `${sec.color}15` }} />
                  {pct > 12 && (
                    <div className="p-1.5 font-mono text-[9px] leading-tight relative z-10">
                      <div className="font-bold truncate" style={{ color: sec.color }}>{sec.label}</div>
                      <div className="text-cyan-500/60">{formatBytes(sec.bytes)}</div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Section details */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {FILE_SIZE_SECTIONS.map((sec) => (
              <div key={sec.label} className="border border-cyan-900/30 bg-cyan-950/20 p-2 font-mono text-[10px] rounded-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: sec.color }} />
                  <span className="text-cyan-300 font-bold truncate">{sec.label}</span>
                </div>
                <div className="text-cyan-100">{formatBytes(sec.bytes)}</div>
                <div className="text-cyan-700">{((sec.bytes / TOTAL_BYTES) * 100).toFixed(1)}%</div>
                {sec.subsections && (
                  <div className="mt-1.5 pt-1.5 border-t border-cyan-900/30 space-y-0.5">
                    {sec.subsections.map(sub => (
                      <div key={sub.label} className="flex justify-between text-cyan-600">
                        <span className="truncate">{sub.label}</span>
                        <span>{formatBytes(sub.bytes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Compression ratio */}
          <div className="flex items-center gap-3 px-2 py-2 border border-cyan-900/30 bg-cyan-950/20 rounded-sm font-mono text-xs">
            <Archive className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <span className="text-cyan-600 uppercase text-[10px] tracking-widest">Compression</span>
            <div className="flex-1 h-2 bg-cyan-950/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${COMPRESSION_RATIO * 100}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full"
                style={{ backgroundColor: ACCENT_EMERALD }}
              />
            </div>
            <span className="text-cyan-300">{formatBytes(Math.round(TOTAL_BYTES * COMPRESSION_RATIO))}</span>
            <span className="text-emerald-400 font-bold">{((1 - COMPRESSION_RATIO) * 100).toFixed(0)}% saved</span>
          </div>
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.2 — Save Data Diff Viewer                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <FileText className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">SAVE_DIFF_VIEWER</span>
          <span className="ml-auto flex items-center gap-2 text-[10px] font-mono">
            <span className="text-cyan-700">Last Save</span>
            <span className="text-cyan-500">→</span>
            <span className="text-cyan-300">Current</span>
          </span>
        </div>

        <div className="p-3 relative z-10">
          {/* Summary stats */}
          <div className="flex gap-2.5 mb-3 font-mono text-[10px]">
            {(['changed', 'added', 'removed', 'unchanged'] as const).map(type => {
              const count = SAVE_DIFF_ENTRIES.filter(e => e.changeType === type).length;
              const colors = { changed: STATUS_WARNING, added: STATUS_SUCCESS, removed: STATUS_ERROR, unchanged: '#64748b' };
              return (
                <span key={type} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[type] }} />
                  <span className="uppercase tracking-widest" style={{ color: colors[type] }}>{type}</span>
                  <span className="text-cyan-100 font-bold">{count}</span>
                </span>
              );
            })}
          </div>

          <DiffViewer entries={SAVE_DIFF_ENTRIES} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.3 — Save Integrity Validator                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center justify-between bg-cyan-950/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">INTEGRITY_VALIDATOR</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest"
              style={{
                backgroundColor: overallValidation === 'PASS' ? `${STATUS_SUCCESS}20` : overallValidation === 'WARN' ? `${STATUS_WARNING}20` : `${STATUS_ERROR}20`,
                color: overallValidation === 'PASS' ? STATUS_SUCCESS : overallValidation === 'WARN' ? STATUS_WARNING : STATUS_ERROR,
                border: `1px solid ${overallValidation === 'PASS' ? STATUS_SUCCESS : overallValidation === 'WARN' ? STATUS_WARNING : STATUS_ERROR}40`,
              }}
            >
              {overallValidation}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-2 relative z-10">
          {VALIDATION_CHECKS.map((check, i) => {
            const statusColor = check.status === 'pass' ? STATUS_SUCCESS : check.status === 'warn' ? STATUS_WARNING : STATUS_ERROR;
            const StatusIcon = check.status === 'pass' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
            return (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 px-3 py-2 border border-cyan-900/30 bg-cyan-950/10 rounded-sm font-mono text-xs hover:border-cyan-700/40 transition-colors group"
              >
                <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor, filter: `drop-shadow(0 0 4px ${statusColor}60)` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-100 font-bold">{check.label}</span>
                    <span className="text-cyan-700 text-[10px] hidden sm:block">{check.description}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: statusColor }}>
                  {check.detail}
                </span>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.4 — Migration Path Visualizer                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <GitBranch className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">MIGRATION_PATH_GRAPH</span>
        </div>

        <div className="p-4 space-y-2.5 relative z-10">
          {/* Version node graph */}
          <div className="flex items-center gap-2 flex-wrap">
            {MIGRATION_PATH.map((node, i, arr) => (
              <div key={node.version} className="flex items-center gap-2">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.12 }}
                  onClick={() => setExpandedMigration(expandedMigration === node.version ? null : node.version)}
                  className={`flex flex-col items-center px-4 py-2.5 border rounded-sm font-mono text-xs transition-all cursor-pointer ${
                    expandedMigration === node.version ? 'border-cyan-500 bg-cyan-950/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]' : 'border-cyan-900/40 bg-cyan-950/10 hover:border-cyan-700/50'
                  }`}
                >
                  <span className={`font-bold ${node.breaking ? 'text-amber-400' : 'text-cyan-300'}`}>{node.version}</span>
                  <span className="text-[9px] text-cyan-700 mt-0.5">{node.date}</span>
                  {node.breaking && (
                    <span className="text-[8px] text-amber-500 mt-1 px-1 py-0.5 bg-amber-950/30 border border-amber-800/30 rounded">BREAKING</span>
                  )}
                </motion.button>
                {i < arr.length - 1 && (
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-px bg-cyan-700/40" />
                    <span className="text-cyan-600 text-[10px]">&gt;</span>
                    <div className="w-4 h-px bg-cyan-700/40" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Expanded migration details */}
          <AnimatePresence>
            {expandedMigration && (() => {
              const node = MIGRATION_PATH.find(n => n.version === expandedMigration);
              if (!node) return null;
              return (
                <motion.div
                  key={node.version}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border border-cyan-900/40 bg-cyan-950/20 p-3 rounded-sm font-mono text-xs space-y-2">
                    <div className="text-cyan-500 text-[10px] uppercase tracking-widest border-b border-cyan-900/30 pb-1">
                      {node.version} Migration Details
                    </div>
                    {node.fieldsAdded.length > 0 && (
                      <div className="space-y-0.5">
                        {node.fieldsAdded.map(f => (
                          <div key={f} className="flex items-center gap-2 text-emerald-400">
                            <span className="text-[10px]">+</span> {f}
                          </div>
                        ))}
                      </div>
                    )}
                    {node.fieldsRemoved.length > 0 && (
                      <div className="space-y-0.5">
                        {node.fieldsRemoved.map(f => (
                          <div key={f} className="flex items-center gap-2 text-red-400 line-through opacity-70">
                            <span className="text-[10px]">-</span> {f}
                          </div>
                        ))}
                      </div>
                    )}
                    {node.fieldsModified.length > 0 && (
                      <div className="space-y-0.5">
                        {node.fieldsModified.map(f => (
                          <div key={f} className="flex items-center gap-2 text-amber-400">
                            <span className="text-[10px]">~</span> {f}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Compatibility matrix */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">Compatibility Matrix</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {COMPAT_MATRIX.map(c => {
                const color = c.compat === 'full' ? STATUS_SUCCESS : c.compat === 'partial' ? STATUS_WARNING : STATUS_ERROR;
                return (
                  <div
                    key={`${c.from}-${c.to}`}
                    className="flex flex-col items-center px-2 py-1.5 border border-cyan-900/30 bg-cyan-950/10 rounded-sm font-mono text-[9px]"
                  >
                    <span className="text-cyan-500">{c.from} → {c.to}</span>
                    <span className="font-bold mt-0.5" style={{ color }}>{c.compat.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.5 — Cloud Save Sync Status                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center justify-between bg-cyan-950/10">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-500" />
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">CLOUD_SYNC_STATUS</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CLOUD_SYNC.status === 'synced' ? STATUS_SUCCESS : CLOUD_SYNC.status === 'syncing' ? STATUS_INFO : CLOUD_SYNC.status === 'conflict' ? STATUS_ERROR : STATUS_WARNING }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-widest"
              style={{ color: CLOUD_SYNC.status === 'synced' ? STATUS_SUCCESS : CLOUD_SYNC.status === 'syncing' ? STATUS_INFO : STATUS_ERROR }}
            >
              {CLOUD_SYNC.status}
            </span>
          </div>
        </div>

        <div className="p-3 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-3 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Last Sync</div>
              <div className="text-cyan-100">{new Date(CLOUD_SYNC.lastSync).toLocaleTimeString()}</div>
              <div className="text-[10px] text-cyan-600 mt-0.5">{new Date(CLOUD_SYNC.lastSync).toLocaleDateString()}</div>
            </div>
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-3 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Conflicts</div>
              <div className="flex items-center gap-1.5">
                <span className={CLOUD_SYNC.conflicts === 0 ? 'text-emerald-400' : 'text-red-400'}>{CLOUD_SYNC.conflicts}</span>
                {CLOUD_SYNC.conflicts === 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </div>
            </div>
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-3 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Queue</div>
              <div className="text-cyan-100">{CLOUD_SYNC.queueSize} pending</div>
              <div className="text-[10px] text-cyan-600 mt-0.5">Latency: {CLOUD_SYNC.latency}ms</div>
            </div>
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-3 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Bandwidth</div>
              <div className="text-cyan-100">{CLOUD_SYNC.bandwidthUsed} / {CLOUD_SYNC.bandwidthLimit}</div>
              <div className="h-1.5 bg-cyan-950/50 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: '2.4%' }} />
              </div>
            </div>
          </div>

          {/* Provider info bar */}
          <div className="mt-3 flex items-center gap-3 px-3 py-2 border border-cyan-900/30 bg-cyan-950/10 rounded-sm font-mono text-[10px]">
            <Wifi className="w-3.5 h-3.5 text-cyan-500" />
            <span className="text-cyan-600 uppercase tracking-widest">Provider:</span>
            <span className="text-cyan-300">{CLOUD_SYNC.provider}</span>
            <span className="ml-auto text-cyan-700">Protocol: WebSocket TLS</span>
          </div>
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.6 — Save Slot Management Dashboard                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <Layers className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">SLOT_MANAGEMENT_DASHBOARD</span>
          <span className="ml-auto text-[10px] font-mono text-cyan-700">{ENHANCED_SLOTS.length} slots</span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
          {ENHANCED_SLOTS.map((slot, i) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`border rounded-sm font-mono overflow-hidden group transition-colors ${
                slot.isAuto ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-cyan-900/40 hover:border-cyan-500/60'
              }`}
            >
              {/* Thumbnail placeholder */}
              <div className={`h-16 flex items-center justify-center text-[10px] uppercase tracking-widest relative overflow-hidden ${
                slot.isAuto ? 'bg-amber-950/20' : 'bg-cyan-950/20'
              }`}>
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.3) 2px, rgba(6,182,212,0.3) 3px)' }} />
                <span className="text-cyan-700 relative z-10">[{slot.screenshotPlaceholder}]</span>
                {slot.isAuto && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-bold border border-amber-500/30 rounded-sm">AUTO</span>
                )}
              </div>

              {/* Slot info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-bold ${slot.isAuto ? 'text-amber-400' : 'text-cyan-300'}`}>{slot.characterName}</div>
                    <div className="text-[10px] text-cyan-600">Lv.{slot.level} {slot.className}</div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="text-cyan-700">{slot.label}</div>
                    <div className="text-cyan-600">{slot.fileSize}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-cyan-700 uppercase block">Zone</span>
                    <span className="text-cyan-100 truncate block">{slot.zone}</span>
                  </div>
                  <div>
                    <span className="text-cyan-700 uppercase block">Playtime</span>
                    <span className="text-cyan-100">{slot.playtime}</span>
                  </div>
                  <div>
                    <span className="text-cyan-700 uppercase block">Last</span>
                    <span className="text-cyan-100">{slot.lastPlayed}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1 border-t border-cyan-900/30">
                  {[
                    { icon: Play, label: 'Load', color: STATUS_SUCCESS },
                    { icon: Trash2, label: 'Delete', color: STATUS_ERROR },
                    { icon: Copy, label: 'Duplicate', color: STATUS_INFO },
                    { icon: Download, label: 'Export', color: ACCENT_CYAN },
                  ].map(action => (
                    <button
                      key={action.label}
                      className="flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] uppercase tracking-wider font-bold transition-colors hover:bg-white/5"
                      style={{ borderColor: `${action.color}30`, color: action.color }}
                    >
                      <action.icon className="w-3 h-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.7 — Serialization Performance Profiler                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center justify-between bg-cyan-950/10">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-cyan-500" />
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">SERIALIZATION_PROFILER</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">
            {SERIALIZATION_TOTAL}ms / {SERIALIZATION_BUDGET_MS}ms budget
          </span>
        </div>

        <div className="p-4 space-y-2.5 relative z-10">
          {/* Stacked bar chart */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 h-10 bg-cyan-950/30 rounded overflow-hidden border border-cyan-900/30">
              {SERIALIZATION_SEGMENTS.map((seg) => {
                const pct = (seg.timeMs / SERIALIZATION_BUDGET_MS) * 100;
                return (
                  <motion.div
                    key={seg.label}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full flex items-center justify-center relative group cursor-default"
                    style={{ backgroundColor: `${seg.color}40`, borderRight: `1px solid ${seg.color}60` }}
                    title={`${seg.label}: ${seg.timeMs}ms`}
                  >
                    {pct > 8 && (
                      <span className="text-[9px] font-mono font-bold relative z-10" style={{ color: seg.color }}>
                        {seg.timeMs}ms
                      </span>
                    )}
                  </motion.div>
                );
              })}
              {/* Remaining budget */}
              <div className="flex-1 h-full flex items-center justify-center">
                <span className="text-[9px] font-mono text-cyan-700">{SERIALIZATION_BUDGET_MS - SERIALIZATION_TOTAL}ms free</span>
              </div>
            </div>

            {/* Budget line */}
            <div className="relative h-1">
              <div className="absolute inset-0 bg-cyan-950/20 rounded-full" />
              <motion.div
                className="absolute top-0 bottom-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(SERIALIZATION_TOTAL / SERIALIZATION_BUDGET_MS) * 100}%` }}
                transition={{ duration: 0.8 }}
                style={{ backgroundColor: SERIALIZATION_TOTAL < SERIALIZATION_BUDGET_MS * 0.75 ? STATUS_SUCCESS : SERIALIZATION_TOTAL < SERIALIZATION_BUDGET_MS * 0.95 ? STATUS_WARNING : STATUS_ERROR }}
              />
            </div>
          </div>

          {/* Per-section breakdown */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-xs">
            {SERIALIZATION_SEGMENTS.map(seg => (
              <div key={seg.label} className="border border-cyan-900/30 bg-cyan-950/20 p-2.5 rounded-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-cyan-300 text-[10px] font-bold">{seg.label}</span>
                </div>
                <div className="text-lg font-bold" style={{ color: seg.color }}>{seg.timeMs}<span className="text-[10px] text-cyan-600">ms</span></div>
                <div className="text-[10px] text-cyan-700">{((seg.timeMs / SERIALIZATION_TOTAL) * 100).toFixed(0)}% of total</div>
              </div>
            ))}
          </div>

          {/* Gauges */}
          <div className="flex justify-center gap-2.5 pt-2 border-t border-cyan-900/30">
            {PERF_METRICS.map(m => (
              <LiveMetricGauge key={m.label} metric={m} size={72} accent={ACCENT} />
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.8 — Auto-Save Configuration Panel                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <Settings className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">AUTO_SAVE_CONFIG</span>
        </div>

        <div className="p-4 space-y-2.5 relative z-10">
          {/* Interval slider (visual only) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-cyan-600 uppercase text-[10px] tracking-widest">Save Interval</span>
              <span className="text-cyan-300 font-bold">{AUTO_SAVE_CONFIG.intervalSeconds}s</span>
            </div>
            <div className="relative h-2 bg-cyan-950/40 rounded-full border border-cyan-900/30">
              <div
                className="absolute top-0 bottom-0 left-0 rounded-full"
                style={{
                  width: `${((AUTO_SAVE_CONFIG.intervalSeconds - 30) / (300 - 30)) * 100}%`,
                  backgroundColor: ACCENT_CYAN,
                  boxShadow: `0 0 8px ${ACCENT_CYAN}40`,
                }}
              />
              <div className="absolute top-full mt-1 flex justify-between w-full text-[9px] font-mono text-cyan-700">
                <span>30s</span>
                <span>120s</span>
                <span>300s</span>
              </div>
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-1.5 mt-6">
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">Triggers</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {AUTO_SAVE_TRIGGERS.map(trigger => (
                <div
                  key={trigger.id}
                  className={`flex items-center gap-2.5 px-3 py-2 border rounded-sm font-mono text-xs transition-colors ${
                    trigger.enabled
                      ? 'border-cyan-700/40 bg-cyan-950/30'
                      : 'border-cyan-900/20 bg-cyan-950/10 opacity-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                      trigger.enabled ? 'border-cyan-500 bg-cyan-500/20' : 'border-cyan-800/40'
                    }`}
                  >
                    {trigger.enabled && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-cyan-200 font-bold text-[11px]">{trigger.label}</div>
                    <div className="text-[9px] text-cyan-700 truncate">{trigger.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional settings */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-2.5 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Max Auto-Saves</div>
              <div className="text-cyan-300 font-bold text-sm">{AUTO_SAVE_CONFIG.maxAutoSaves}</div>
              <div className="text-[9px] text-cyan-600">Range: 3-10 slots</div>
            </div>
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-2.5 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Combat Save</div>
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-3 rounded-full relative ${AUTO_SAVE_CONFIG.combatSaveEnabled ? 'bg-cyan-500/30' : 'bg-red-900/30'}`}>
                  <span className={`absolute top-0.5 w-2 h-2 rounded-full transition-all ${AUTO_SAVE_CONFIG.combatSaveEnabled ? 'left-3.5 bg-cyan-400' : 'left-0.5 bg-red-400'}`} />
                </span>
                <span className={AUTO_SAVE_CONFIG.combatSaveEnabled ? 'text-cyan-300' : 'text-red-400'}>{AUTO_SAVE_CONFIG.combatSaveEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="text-[9px] text-cyan-600 mt-0.5">Disabled during boss fights</div>
            </div>
            <div className="border border-cyan-900/30 bg-cyan-950/20 p-2.5 rounded-sm">
              <div className="text-[9px] text-cyan-700 uppercase tracking-widest mb-1">Compression</div>
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-3 rounded-full relative ${AUTO_SAVE_CONFIG.compressionEnabled ? 'bg-emerald-500/30' : 'bg-cyan-900/30'}`}>
                  <span className={`absolute top-0.5 w-2 h-2 rounded-full transition-all ${AUTO_SAVE_CONFIG.compressionEnabled ? 'left-3.5 bg-emerald-400' : 'left-0.5 bg-cyan-600'}`} />
                </span>
                <span className={AUTO_SAVE_CONFIG.compressionEnabled ? 'text-emerald-300' : 'text-cyan-600'}>{AUTO_SAVE_CONFIG.compressionEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div className="text-[9px] text-cyan-600 mt-0.5">LZ4 fast compression</div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.9 — Schema Version History                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <History className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">SCHEMA_VERSION_HISTORY</span>
          <span className="ml-auto text-[10px] font-mono text-cyan-700">{SCHEMA_VERSION_HISTORY.length} versions</span>
        </div>

        <div className="p-4 space-y-2 relative z-10">
          {SCHEMA_VERSION_HISTORY.map((entry, i) => (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <button
                onClick={() => setExpandedVersion(expandedVersion === entry.version ? null : entry.version)}
                className={`w-full text-left border rounded-sm font-mono text-xs transition-all ${
                  entry.isCurrent
                    ? 'border-cyan-500/50 bg-cyan-950/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'border-cyan-900/30 bg-cyan-950/10 hover:border-cyan-700/40'
                }`}
              >
                <div className="px-3 py-2.5 flex items-center gap-3">
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-cyan-600 transition-transform flex-shrink-0 ${expandedVersion === entry.version ? 'rotate-90' : ''}`}
                  />
                  <span className={`font-bold ${entry.isCurrent ? 'text-cyan-300' : 'text-cyan-500'}`}>{entry.version}</span>
                  <span className="text-cyan-700 text-[10px]">{entry.date}</span>
                  <span className="text-cyan-700 text-[10px]">by {entry.author}</span>
                  {entry.isCurrent && (
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[8px] font-bold border border-cyan-500/30 rounded-sm">CURRENT</span>
                  )}
                  {entry.breaking && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[8px] font-bold border border-amber-500/30 rounded-sm">BREAKING</span>
                  )}
                  <span className="ml-auto text-[10px] text-cyan-700">{entry.changes.length} changes</span>
                </div>
              </button>

              <AnimatePresence>
                {expandedVersion === entry.version && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 py-2 border-x border-b border-cyan-900/30 bg-cyan-950/20 space-y-1 rounded-b-sm">
                      {entry.changes.map((change, ci) => {
                        const changeColor = change.type === 'added' ? STATUS_SUCCESS : change.type === 'removed' ? STATUS_ERROR : STATUS_WARNING;
                        const prefix = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
                        return (
                          <div key={ci} className="flex items-start gap-2 py-0.5 font-mono text-[11px]">
                            <span className="flex-shrink-0 font-bold w-3 text-center" style={{ color: changeColor }}>{prefix}</span>
                            <span className="text-cyan-200 font-bold flex-shrink-0">{change.field}</span>
                            <span className="text-cyan-600 truncate">{change.detail}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11.10 — Data Recovery Tool                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-0 border-cyan-900/30 bg-[#060b11] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)', backgroundSize: '20px 20px' }} />
        <div className="px-4 py-3 border-b border-cyan-900/40 flex items-center gap-2 bg-cyan-950/10">
          <Wrench className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">DATA_RECOVERY_TOOL</span>
        </div>

        <div className="p-4 space-y-2.5 relative z-10">
          {/* Step indicators */}
          <div className="flex items-center gap-1 justify-center">
            {RECOVERY_STEPS.map((step, i, arr) => {
              const stepIndex = RECOVERY_STEPS.findIndex(s => s.id === recoveryStep);
              const isComplete = i <= stepIndex;
              const isCurrent = i === stepIndex;
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: isCurrent ? 1.1 : 1 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest border transition-all ${
                      isCurrent
                        ? 'border-cyan-500 bg-cyan-950/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : isComplete
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                          : 'border-cyan-900/30 bg-cyan-950/10 text-cyan-700'
                    }`}
                  >
                    {isComplete && !isCurrent && <CheckCircle2 className="w-3 h-3" />}
                    {step.label}
                  </motion.div>
                  {i < arr.length - 1 && (
                    <div className={`w-6 h-px ${isComplete ? 'bg-emerald-500/40' : 'bg-cyan-900/30'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Recovery confidence gauge */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-[72px] h-[72px]">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                  <circle
                    cx="36" cy="36" r="28" fill="none"
                    stroke={recoveryOverall >= 80 ? STATUS_SUCCESS : recoveryOverall >= 50 ? STATUS_WARNING : STATUS_ERROR}
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - recoveryOverall / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 36 36)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out', filter: `drop-shadow(0 0 6px ${recoveryOverall >= 80 ? STATUS_SUCCESS : STATUS_WARNING})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-lg font-mono font-bold" style={{ color: recoveryOverall >= 80 ? STATUS_SUCCESS : STATUS_WARNING }}>
                    {Math.round(recoveryOverall)}%
                  </span>
                  <span className="text-[8px] font-mono text-cyan-600 uppercase">confidence</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recovery results */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest">Recovery Results</span>
            {RECOVERY_RESULTS.map((result, i) => {
              const statusColor = result.status === 'recovered' ? STATUS_SUCCESS : result.status === 'partial' ? STATUS_WARNING : STATUS_ERROR;
              const StatusIcon = result.status === 'recovered' ? CheckCircle2 : result.status === 'partial' ? AlertTriangle : XCircle;
              return (
                <motion.div
                  key={result.field}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 px-3 py-2 border border-cyan-900/30 bg-cyan-950/10 rounded-sm font-mono text-xs"
                >
                  <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
                  <span className="text-cyan-200 font-bold w-36 flex-shrink-0">{result.field}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest w-20 flex-shrink-0" style={{ color: statusColor }}>
                    {result.status}
                  </span>
                  <div className="flex-1 h-1.5 bg-cyan-950/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: statusColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                    />
                  </div>
                  <span className="text-cyan-400 font-bold text-[10px] w-8 text-right flex-shrink-0">{result.confidence}%</span>
                  <span className="text-cyan-700 text-[10px] hidden lg:block truncate">{result.detail}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3 px-3 py-2 border border-cyan-900/30 bg-cyan-950/20 rounded-sm font-mono text-[10px]">
            <RotateCcw className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
            <span className="text-cyan-600 uppercase tracking-widest">Summary:</span>
            <span className="text-emerald-400">{RECOVERY_RESULTS.filter(r => r.status === 'recovered').length} recovered</span>
            <span className="text-cyan-700">|</span>
            <span className="text-amber-400">{RECOVERY_RESULTS.filter(r => r.status === 'partial').length} partial</span>
            <span className="text-cyan-700">|</span>
            <span className="text-red-400">{RECOVERY_RESULTS.filter(r => r.status === 'lost').length} lost</span>
          </div>
        </div>
      </SurfaceCard>

      {/* Features List */}
      <div className="space-y-1.5 pt-2">
        <SectionLabel label="Engine Subsystems" />
        {FEATURE_NAMES.map((name) => (
          <FeatureCard
            key={name}
            name={name}
            featureMap={featureMap}
            defs={defs}
            expanded={expandedFeature}
            onToggle={toggleFeature}
            accent={ACCENT}
          />
        ))}
      </div>
    </div>
  );
}
