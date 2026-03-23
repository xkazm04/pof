import {
  MODULE_COLORS,
  ACCENT_CYAN, ACCENT_EMERALD, STATUS_SUBDUED,
} from '@/lib/chart-colors';
import type { DiffEntry } from '@/types/unique-tab-improvements';

/* ── Budget Alerting ─────────────────────────────────────────────────────── */

export interface SectionBudget {
  sectionLabel: string; budgetBytes: number; color: string;
}

export const SECTION_BUDGETS: SectionBudget[] = [
  { sectionLabel: 'InventoryItems', budgetBytes: 204800, color: MODULE_COLORS.content },
  { sectionLabel: 'PlayerProgression', budgetBytes: 65536, color: ACCENT_CYAN },
  { sectionLabel: 'WorldState', budgetBytes: 51200, color: MODULE_COLORS.systems },
  { sectionLabel: 'Settings', budgetBytes: 16384, color: ACCENT_EMERALD },
  { sectionLabel: 'Metadata', budgetBytes: 8192, color: STATUS_SUBDUED },
];

export interface GrowthSnapshot {
  version: string; sectionBytes: Record<string, number>;
}

export const GROWTH_HISTORY: GrowthSnapshot[] = [
  { version: 'V1.0', sectionBytes: { InventoryItems: 32768, PlayerProgression: 16384, WorldState: 0, Settings: 6144, Metadata: 2048 } },
  { version: 'V1.1', sectionBytes: { InventoryItems: 65536, PlayerProgression: 24576, WorldState: 0, Settings: 6144, Metadata: 3072 } },
  { version: 'V1.2', sectionBytes: { InventoryItems: 98304, PlayerProgression: 32768, WorldState: 16384, Settings: 8192, Metadata: 4096 } },
  { version: 'V2.0', sectionBytes: { InventoryItems: 131072, PlayerProgression: 46080, WorldState: 32768, Settings: 8192, Metadata: 4096 } },
];

export function getBudgetStatus(current: number, budget: number): 'ok' | 'amber' | 'red' {
  const ratio = current / budget;
  if (ratio >= 1) return 'red';
  if (ratio >= 0.8) return 'amber';
  return 'ok';
}

export function projectGrowth(history: number[]): number {
  if (history.length < 2) return history[history.length - 1] ?? 0;
  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += history[i]; sumXY += i * history[i]; sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return Math.max(0, Math.round(slope * n + intercept));
}

/* ── Save Diff ───────────────────────────────────────────────────────────── */

export const SAVE_DIFF_ENTRIES: DiffEntry[] = [
  { field: 'Level', oldValue: 13, newValue: 14, changeType: 'changed' },
  { field: 'XP', oldValue: 4200, newValue: 5100, changeType: 'changed' },
  { field: 'CurrentZone', oldValue: 'Verdant Plains', newValue: 'The Ashlands', changeType: 'changed' },
  { field: 'Health', oldValue: 340, newValue: 380, changeType: 'changed' },
  { field: 'SteelSword', oldValue: '', newValue: 'Steel Sword +2', changeType: 'added' },
  { field: 'AshlandsVisited', oldValue: '', newValue: 'true', changeType: 'added' },
  { field: 'OldTutorialFlag', oldValue: 'skip_intro', newValue: '', changeType: 'removed' },
  { field: 'GoldAmount', oldValue: 1250, newValue: 1250, changeType: 'unchanged' },
];

/* ── Enhanced Slots ──────────────────────────────────────────────────────── */

export interface EnhancedSlot {
  id: string; label: string; isAuto: boolean;
  characterName: string; className: string; level: number;
  zone: string; playtime: string; lastPlayed: string;
  fileSize: string; integrity: string; screenshotPlaceholder: string;
}

export const ENHANCED_SLOTS: EnhancedSlot[] = [
  { id: 'auto', label: 'AUTO_SAVE', isAuto: true, characterName: 'Kael', className: 'Battlemage', level: 14, zone: 'The Ashlands', playtime: '4h 28m', lastPlayed: '8 min ago', fileSize: '217KB', integrity: '100%', screenshotPlaceholder: 'Ashlands Overlook' },
  { id: 'slot-1', label: 'SLOT-01', isAuto: false, characterName: 'Kael', className: 'Battlemage', level: 14, zone: 'The Ashlands', playtime: '4h 32m', lastPlayed: '2 hours ago', fileSize: '215KB', integrity: '100%', screenshotPlaceholder: 'Boss Arena Gate' },
  { id: 'slot-2', label: 'SLOT-02', isAuto: false, characterName: 'Lyra', className: 'Ranger', level: 7, zone: 'Verdant Plains', playtime: '1h 58m', lastPlayed: '1 day ago', fileSize: '142KB', integrity: '98%', screenshotPlaceholder: 'Plains Campfire' },
  { id: 'slot-3', label: 'SLOT-03', isAuto: false, characterName: 'Gorath', className: 'Berserker', level: 1, zone: 'Tutorial Zone', playtime: '0h 12m', lastPlayed: '3 days ago', fileSize: '48KB', integrity: '100%', screenshotPlaceholder: 'Starting Village' },
];

export function slotVal(slot: EnhancedSlot, key: keyof EnhancedSlot): string | number {
  const v = slot[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  return String(v);
}

export function buildSlotDiff(slotA: EnhancedSlot, slotB: EnhancedSlot): DiffEntry[] {
  const fields: { field: string; key: keyof EnhancedSlot }[] = [
    { field: 'CharacterName', key: 'characterName' },
    { field: 'Class', key: 'className' },
    { field: 'Level', key: 'level' },
    { field: 'Zone', key: 'zone' },
    { field: 'Playtime', key: 'playtime' },
    { field: 'LastPlayed', key: 'lastPlayed' },
    { field: 'FileSize', key: 'fileSize' },
    { field: 'Integrity', key: 'integrity' },
    { field: 'Screenshot', key: 'screenshotPlaceholder' },
  ];
  return fields.map(({ field, key }) => {
    const a = slotVal(slotA, key);
    const b = slotVal(slotB, key);
    if (a !== b) return { field, oldValue: a, newValue: b, changeType: 'changed' as const };
    return { field, oldValue: a, newValue: b, changeType: 'unchanged' as const };
  });
}
