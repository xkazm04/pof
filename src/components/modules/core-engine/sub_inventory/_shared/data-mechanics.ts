import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  STATUS_NEUTRAL, STATUS_BLOCKER, STATUS_INFO, ACCENT_PURPLE,
  RARITY_COLORS,
} from '@/lib/chart-colors';
import type { RadarDataPoint, ProbabilityEntry } from '@/types/unique-tab-improvements';

/* ── 6.1 Item Power Budget Radar Data ────────────────────────────────── */

export const POWER_BUDGET_AXES = ['Offense', 'Defense', 'Utility', 'Economic', 'Rarity'];

export const IRON_LONGSWORD_RADAR: RadarDataPoint[] = [
  { axis: 'Offense', value: 0.35, maxLabel: '100' },
  { axis: 'Defense', value: 0.1, maxLabel: '100' },
  { axis: 'Utility', value: 0.2, maxLabel: '100' },
  { axis: 'Economic', value: 0.15, maxLabel: '1000g' },
  { axis: 'Rarity', value: 0.2, maxLabel: 'Legendary' },
];

export const VOID_DAGGERS_RADAR: RadarDataPoint[] = [
  { axis: 'Offense', value: 0.92, maxLabel: '100' },
  { axis: 'Defense', value: 0.05, maxLabel: '100' },
  { axis: 'Utility', value: 0.55, maxLabel: '100' },
  { axis: 'Economic', value: 0.95, maxLabel: '1000g' },
  { axis: 'Rarity', value: 1.0, maxLabel: 'Legendary' },
];

/* ── 6.2 Affix Probability Tree Data ────────────────────────────────── */

export const AFFIX_PROB_TREE: ProbabilityEntry = {
  id: 'rare-root',
  label: 'Rare',
  probability: 1,
  color: RARITY_COLORS.Rare,
  children: [
    { id: 'prefix-0', label: '0 Prefixes', probability: 0.2, color: STATUS_NEUTRAL, children: [] },
    {
      id: 'prefix-1', label: '1 Prefix', probability: 0.5, color: MODULE_COLORS.core,
      children: [
        { id: 'p1-power', label: 'Power', probability: 0.4, color: STATUS_ERROR },
        { id: 'p1-fortitude', label: 'Fortitude', probability: 0.3, color: STATUS_SUCCESS },
        { id: 'p1-blazing', label: 'Blazing', probability: 0.2, color: STATUS_BLOCKER },
        { id: 'p1-vampiric', label: 'Vampiric', probability: 0.1, color: ACCENT_PURPLE },
      ],
    },
    {
      id: 'prefix-2', label: '2 Prefixes', probability: 0.3, color: STATUS_WARNING,
      children: [
        { id: 'p2-power', label: 'Power', probability: 0.4, color: STATUS_ERROR },
        { id: 'p2-fortitude', label: 'Fortitude', probability: 0.3, color: STATUS_SUCCESS },
        { id: 'p2-blazing', label: 'Blazing', probability: 0.2, color: STATUS_BLOCKER },
        { id: 'p2-vampiric', label: 'Vampiric', probability: 0.1, color: ACCENT_PURPLE },
      ],
    },
  ],
};

/* ── 6.9 Item Level Scaling Data ─────────────────────────────────────── */

export interface ScalingLine {
  label: string;
  color: string;
  points: { level: number; min: number; max: number }[];
}

export const SCALING_LINES: ScalingLine[] = [
  {
    label: 'Weapon Damage', color: STATUS_ERROR,
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5, base = 5 + lvl * 2;
      return { level: lvl, min: base * 0.85, max: base * 1.15 };
    }),
  },
  {
    label: 'Armor Defense', color: STATUS_INFO,
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5, base = 10 + lvl * 1.5;
      return { level: lvl, min: base * 0.9, max: base * 1.1 };
    }),
  },
  {
    label: 'Affix Magnitude', color: STATUS_SUCCESS,
    points: Array.from({ length: 10 }, (_, i) => {
      const lvl = (i + 1) * 5, base = 2 + lvl * 0.8;
      return { level: lvl, min: base * 0.8, max: base * 1.2 };
    }),
  },
];
