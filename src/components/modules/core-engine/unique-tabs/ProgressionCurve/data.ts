import {
  Swords, Wand2, Sword, FastForward, Layers, Shield,
  Trophy, Zap, Star,
} from 'lucide-react';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK,
} from '@/lib/chart-colors';
import type { ChartSeries, RadarDataPoint } from '@/types/unique-tab-improvements';

export const ACCENT = STATUS_WARNING;

export const MAX_LEVEL = 50;

export function calculateXpForLevel(level: number, base: number, exponent: number): number {
  return Math.floor(base * Math.pow(level, exponent));
}

export const generateChartData = (base: number, exp: number) => {
  const data = [];
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl += 5) {
    const levelToUse = lvl > MAX_LEVEL ? MAX_LEVEL : lvl;
    data.push({
      level: levelToUse,
      xp: calculateXpForLevel(levelToUse, base, exp),
      totalParams: Math.floor(levelToUse * 1.5),
    });
  }
  return data;
};

export const PROGRESSION_FEATURES = [
  'Data Asset for curves',
  'SaveGame system integration',
  'Global parameter modifiers',
  'Level up animation',
  'Skill point allocation UI',
];

/* -- Milestone unlocks for the main chart --------------------------------- */

export const ABILITY_UNLOCKS = [
  { level: 5, name: 'Dodge Roll', class: 'Movement' },
  { level: 10, name: 'Heavy Strike', class: 'Attack' },
  { level: 25, name: 'Ultimate Power', class: 'Ultimate' },
  { level: 40, name: 'Ascension', class: 'Passive' },
];

/* -- 8.1 Multi-Curve Overlay Data ----------------------------------------- */

export const MULTI_CURVE_SERIES: ChartSeries[] = [
  {
    id: 'xp', label: 'XP Required', color: STATUS_WARNING,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: Math.floor(100 * Math.pow(i * 5 || 1, 1.5)) })),
    visible: true,
  },
  {
    id: 'hp', label: 'HP', color: STATUS_SUCCESS,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 100 + i * 5 * 20 })),
    visible: true,
  },
  {
    id: 'mana', label: 'Mana', color: ACCENT_CYAN,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 50 + i * 5 * 12 })),
    visible: true,
  },
  {
    id: 'damage', label: 'Damage', color: STATUS_ERROR,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 10 + i * 5 * 8 + Math.floor(Math.pow(i * 5, 1.2)) })),
    visible: true,
  },
  {
    id: 'enemy_hp', label: 'Enemy HP', color: ACCENT_VIOLET,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 80 + i * 5 * 25 + Math.floor(Math.pow(i * 5, 1.3)) })),
    visible: true,
  },
];

/* -- 8.2 Build Path Comparison Data --------------------------------------- */

export const BUILD_STATS = ['Strength', 'Intelligence', 'Dexterity', 'Vitality', 'Endurance'] as const;

export interface BuildPreset {
  name: string;
  icon: typeof Swords;
  color: string;
  stats: Record<typeof BUILD_STATS[number], number>;
  radarData: RadarDataPoint[];
}

export const BUILD_PRESETS: BuildPreset[] = [
  {
    name: 'Warrior', icon: Swords, color: STATUS_ERROR,
    stats: { Strength: 85, Intelligence: 20, Dexterity: 45, Vitality: 90, Endurance: 75 },
    radarData: [
      { axis: 'STR', value: 0.85 }, { axis: 'INT', value: 0.2 },
      { axis: 'DEX', value: 0.45 }, { axis: 'VIT', value: 0.9 }, { axis: 'END', value: 0.75 },
    ],
  },
  {
    name: 'Mage', icon: Wand2, color: ACCENT_CYAN,
    stats: { Strength: 15, Intelligence: 95, Dexterity: 30, Vitality: 40, Endurance: 35 },
    radarData: [
      { axis: 'STR', value: 0.15 }, { axis: 'INT', value: 0.95 },
      { axis: 'DEX', value: 0.3 }, { axis: 'VIT', value: 0.4 }, { axis: 'END', value: 0.35 },
    ],
  },
  {
    name: 'Rogue', icon: Sword, color: ACCENT_EMERALD,
    stats: { Strength: 40, Intelligence: 35, Dexterity: 95, Vitality: 50, Endurance: 45 },
    radarData: [
      { axis: 'STR', value: 0.4 }, { axis: 'INT', value: 0.35 },
      { axis: 'DEX', value: 0.95 }, { axis: 'VIT', value: 0.5 }, { axis: 'END', value: 0.45 },
    ],
  },
];

/* -- 8.4 Level-Up Reward Preview Data ------------------------------------- */

export const LEVEL_REWARDS = [
  { level: 5, name: 'Dodge Roll', type: 'Ability', icon: FastForward, color: ACCENT_CYAN },
  { level: 10, name: 'Heavy Strike', type: 'Ability', icon: Swords, color: STATUS_ERROR },
  { level: 15, name: 'Fire Bolt', type: 'Spell', icon: Wand2, color: ACCENT_ORANGE },
  { level: 20, name: 'Skill Tree Tier 2', type: 'Unlock', icon: Layers, color: ACCENT_VIOLET },
  { level: 25, name: 'Ultimate', type: 'Ultimate', icon: Zap, color: STATUS_WARNING },
  { level: 30, name: 'Passive Mastery', type: 'Passive', icon: Shield, color: ACCENT_EMERALD },
  { level: 40, name: 'Ascension', type: 'Milestone', icon: Star, color: ACCENT_PINK },
  { level: 50, name: 'Prestige Unlock', type: 'Prestige', icon: Trophy, color: STATUS_WARNING },
];

/* -- 8.6 Power Curve Danger Zones Data ------------------------------------ */

export const DANGER_ZONE_LEVELS = Array.from({ length: 11 }, (_, i) => i * 5);
export const PLAYER_POWER = [10, 35, 70, 120, 180, 250, 340, 450, 580, 730, 900];
export const ENEMY_DIFFICULTY = [15, 30, 55, 100, 160, 240, 330, 420, 520, 650, 820];

/* -- 8.7 Diminishing Returns Data ----------------------------------------- */

export const DR_ATTRIBUTES = [
  {
    name: 'Strength', color: STATUS_ERROR, softCap: 60,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 6 ? 10 - i * 0.5 : Math.max(10 - i * 1.5, 1),
    })),
  },
  {
    name: 'Dexterity', color: ACCENT_EMERALD, softCap: 50,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 5 ? 12 - i * 0.8 : Math.max(12 - i * 2, 0.5),
    })),
  },
  {
    name: 'Intelligence', color: ACCENT_CYAN, softCap: 70,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 7 ? 8 - i * 0.3 : Math.max(8 - i * 1.2, 0.8),
    })),
  },
];

/* -- Comparison levels for delta summary ---------------------------------- */

export const COMPARISON_LEVELS = [10, 20, 30, 40, 50] as const;
