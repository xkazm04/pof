import {
  STATUS_ERROR, STATUS_NEUTRAL,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { HeatmapCell, TimelineEvent, SankeyLink, SankeyColumn, PieSlice, GaugeMetric } from '@/types/unique-tab-improvements';

/* ── DPS Calculator data ───────────────────────────────────────────────── */

export interface DPSStrategy {
  name: string;
  dps: number;
  time: string;
  color: string;
}

export const DPS_STRATEGIES: DPSStrategy[] = [
  { name: 'SingleAttackSpam', dps: 180, time: 'Infinite', color: STATUS_NEUTRAL },
  { name: 'Full3HitCombo', dps: 245, time: '1.55s', color: ACCENT_CYAN },
  { name: 'CancelIntoAbility', dps: 310, time: '1.2s', color: ACCENT_EMERALD },
];

export const DPS_MAX = 310;
export const CUMULATIVE_POINTS = [0, 1, 2, 3, 4, 5];

/* ── Damage Type Effectiveness data ────────────────────────────────────── */

export const DMG_TYPES = ['Physical', 'Fire', 'Ice', 'Lightning'];
export const ARMOR_TYPES = ['Light', 'Medium', 'Heavy', 'Magical'];

export const EFFECTIVENESS_DATA: HeatmapCell[] = [
  { row: 0, col: 0, value: 0.8, label: '1.2', tooltip: 'Physical vs Light: 1.2x (effective)' },
  { row: 0, col: 1, value: 0.6, label: '1.0', tooltip: 'Physical vs Medium: 1.0x (neutral)' },
  { row: 0, col: 2, value: 0.2, label: '0.5', tooltip: 'Physical vs Heavy: 0.5x (resisted)' },
  { row: 0, col: 3, value: 0.4, label: '0.8', tooltip: 'Physical vs Magical: 0.8x (slightly resisted)' },
  { row: 1, col: 0, value: 1.0, label: '1.5', tooltip: 'Fire vs Light: 1.5x (very effective)' },
  { row: 1, col: 1, value: 0.7, label: '1.1', tooltip: 'Fire vs Medium: 1.1x (slightly effective)' },
  { row: 1, col: 2, value: 0.5, label: '0.9', tooltip: 'Fire vs Heavy: 0.9x (slightly resisted)' },
  { row: 1, col: 3, value: 0.25, label: '0.7', tooltip: 'Fire vs Magical: 0.7x (resisted)' },
  { row: 2, col: 0, value: 0.5, label: '0.9', tooltip: 'Ice vs Light: 0.9x (slightly resisted)' },
  { row: 2, col: 1, value: 0.85, label: '1.3', tooltip: 'Ice vs Medium: 1.3x (effective)' },
  { row: 2, col: 2, value: 0.7, label: '1.1', tooltip: 'Ice vs Heavy: 1.1x (slightly effective)' },
  { row: 2, col: 3, value: 0.6, label: '1.0', tooltip: 'Ice vs Magical: 1.0x (neutral)' },
  { row: 3, col: 0, value: 0.6, label: '1.0', tooltip: 'Lightning vs Light: 1.0x (neutral)' },
  { row: 3, col: 1, value: 0.5, label: '0.9', tooltip: 'Lightning vs Medium: 0.9x (slightly resisted)' },
  { row: 3, col: 2, value: 0.3, label: '0.6', tooltip: 'Lightning vs Heavy: 0.6x (resisted)' },
  { row: 3, col: 3, value: 1.0, label: '1.5', tooltip: 'Lightning vs Magical: 1.5x (very effective)' },
];

/* ── Combat Flow Sankey data ───────────────────────────────────────────── */

export const SANKEY_COLUMNS: SankeyColumn[] = [
  {
    label: 'Input',
    items: [
      { id: 'light', label: 'LightAttack', pct: 60, color: ACCENT_CYAN },
      { id: 'heavy', label: 'HeavyAttack', pct: 25, color: ACCENT_ORANGE },
      { id: 'dodge', label: 'Dodge', pct: 15, color: ACCENT_EMERALD },
    ],
  },
  {
    label: 'Result',
    items: [
      { id: 'hit', label: 'Hit', pct: 70, color: ACCENT_EMERALD },
      { id: 'miss', label: 'Miss', pct: 20, color: STATUS_NEUTRAL },
      { id: 'blocked', label: 'Blocked', pct: 10, color: ACCENT_ORANGE },
    ],
  },
  {
    label: 'Outcome',
    items: [
      { id: 'damage', label: 'Damage', pct: 55, color: ACCENT_EMERALD },
      { id: 'stagger', label: 'Stagger', pct: 15, color: ACCENT_VIOLET },
      { id: 'kill', label: 'Kill', pct: 5, color: STATUS_ERROR },
      { id: 'noDmg', label: 'NoDamage', pct: 25, color: STATUS_NEUTRAL },
    ],
  },
];

export const SANKEY_FLOWS: SankeyLink[] = [
  { source: 'light', target: 'hit', value: 45, color: ACCENT_CYAN },
  { source: 'light', target: 'miss', value: 10, color: STATUS_NEUTRAL },
  { source: 'light', target: 'blocked', value: 5, color: ACCENT_ORANGE },
  { source: 'heavy', target: 'hit', value: 18, color: ACCENT_ORANGE },
  { source: 'heavy', target: 'miss', value: 5, color: STATUS_NEUTRAL },
  { source: 'heavy', target: 'blocked', value: 2, color: ACCENT_ORANGE },
  { source: 'dodge', target: 'hit', value: 7, color: ACCENT_EMERALD },
  { source: 'dodge', target: 'miss', value: 5, color: STATUS_NEUTRAL },
  { source: 'dodge', target: 'blocked', value: 3, color: ACCENT_ORANGE },
  { source: 'hit', target: 'damage', value: 45, color: ACCENT_EMERALD },
  { source: 'hit', target: 'stagger', value: 15, color: ACCENT_VIOLET },
  { source: 'hit', target: 'kill', value: 5, color: STATUS_ERROR },
  { source: 'hit', target: 'noDmg', value: 5, color: STATUS_NEUTRAL },
  { source: 'miss', target: 'noDmg', value: 15, color: STATUS_NEUTRAL },
  { source: 'miss', target: 'damage', value: 5, color: ACCENT_EMERALD },
  { source: 'blocked', target: 'damage', value: 5, color: ACCENT_EMERALD },
  { source: 'blocked', target: 'noDmg', value: 5, color: STATUS_NEUTRAL },
];

/* ── Hitstop Timing data ──────────────────────────────────────────────── */

export interface HitstopAbility {
  name: string;
  hitstop: number;
  animDuration: number;
  color: string;
}

export const HITSTOP_ABILITIES: HitstopAbility[] = [
  { name: 'LightAttack1', hitstop: 0.03, animDuration: 0.4, color: ACCENT_CYAN },
  { name: 'LightAttack2', hitstop: 0.04, animDuration: 0.5, color: ACCENT_CYAN },
  { name: 'LightAttack3', hitstop: 0.06, animDuration: 0.6, color: ACCENT_ORANGE },
  { name: 'HeavyAttack', hitstop: 0.10, animDuration: 0.9, color: ACCENT_VIOLET },
  { name: 'Slam', hitstop: 0.15, animDuration: 1.2, color: STATUS_ERROR },
];

export const MAX_HITSTOP = 0.15;

/* ── Combat Metrics data ──────────────────────────────────────────────── */

export interface KPICard {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  barPct?: number;
  barColor?: string;
  context?: string;
}

export const KPI_CARDS: KPICard[] = [
  { label: 'Total Damage Dealt', value: '12,450', trend: '+15%', trendColor: ACCENT_EMERALD, context: 'Last 100 combat encounters' },
  { label: 'Crit Rate', value: '18%', barPct: 18, barColor: ACCENT_ORANGE, context: 'Rolling avg over 500 attacks' },
  { label: 'Dodge Success', value: '85%', barPct: 85, barColor: ACCENT_CYAN, context: 'Successful i-frame dodges vs total attempts' },
  { label: 'Avg Combo Length', value: '2.3', barPct: 46, barColor: ACCENT_VIOLET, context: 'Mean hits per combo chain (max 5)' },
];

export const HIT_ACCURACY_GAUGE: GaugeMetric = {
  label: 'Hit Accuracy',
  current: 73,
  target: 100,
  unit: '%',
  trend: 'up',
};

export const ABILITY_USAGE: PieSlice[] = [
  { label: 'MeleeAttack', pct: 45, color: ACCENT_ORANGE },
  { label: 'Dodge', pct: 25, color: ACCENT_CYAN },
  { label: 'Fireball', pct: 20, color: STATUS_ERROR },
  { label: 'Other', pct: 10, color: STATUS_NEUTRAL },
];

/* ── Stagger & Status Effect data ─────────────────────────────────────── */

export const STAGGER_CONFIG = {
  currentStagger: 67,
  threshold: 100,
  decayRate: 5,
};

export const STAGGER_PIPELINE_STEPS = ['Hits Accumulate', 'Threshold Reached', 'Stun Triggered', 'Recovery'];

export const STAGGER_TIMELINE: TimelineEvent[] = [
  { id: 'st1', timestamp: 0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st2', timestamp: 1.2, label: '+20', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st3', timestamp: 2.5, label: '-5 decay', category: 'decay', color: STATUS_NEUTRAL, duration: 1.0 },
  { id: 'st4', timestamp: 3.8, label: '+25', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st5', timestamp: 5.0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st6', timestamp: 6.2, label: '-5 decay', category: 'decay', color: STATUS_NEUTRAL, duration: 1.0 },
  { id: 'st7', timestamp: 7.5, label: 'STUN', category: 'stun', color: STATUS_ERROR, duration: 1.5 },
  { id: 'st8', timestamp: 9.0, label: 'Recovery', category: 'recovery', color: ACCENT_EMERALD, duration: 1.0 },
];

/* ── Combo chain sections ──────────────────────────────────────────────── */

export const COMBO_SECTIONS = [
  { name: 'Attack 1', timing: '0.0s - 0.4s', window: 'Combo Window', pct: 60 },
  { name: 'Attack 2', timing: '0.0s - 0.5s', window: 'Combo Window', pct: 70 },
  { name: 'Attack 3', timing: '0.0s - 0.6s', window: 'Finisher', pct: 85 },
];
