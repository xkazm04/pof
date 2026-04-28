import {
  TrendingUp, Layers, BarChart3, AlertTriangle,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { RARITY_COLOR_MAP } from '@/lib/economy/definitions';
import type { SubTab } from '../_shared';
import type { ItemRarity } from '@/types/economy-simulator';

/* ── Accent ───────────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_ORANGE;

/* ── Rarity colors (canonical map from @/lib/economy/definitions) ─────── */

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: RARITY_COLOR_MAP.Common,
  uncommon: RARITY_COLOR_MAP.Uncommon,
  rare: RARITY_COLOR_MAP.Rare,
  epic: RARITY_COLOR_MAP.Epic,
  legendary: RARITY_COLOR_MAP.Legendary,
};

export const RARITY_LABELS: ItemRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
];

/* ── Stat display names ───────────────────────────────────────────────── */

export const STAT_LABELS: Record<string, string> = {
  strength: 'STR', attackPower: 'ATK', armor: 'ARM', maxHealth: 'HP',
  critChance: 'CRIT%', critDamage: 'CDMG', attackSpeed: 'ASPD', armorPen: 'PEN',
  healthRegen: 'REGEN', maxMana: 'MANA', cooldownReduction: 'CDR', dodgeChance: 'DODGE',
  moveSpeed: 'SPD', goldFind: 'GOLD', magicFind: 'MF', xpBonus: 'XP',
};

/* ── Alert severity colors ────────────────────────────────────────────── */

export const ALERT_COLORS: Record<string, string> = {
  info: MODULE_COLORS.core,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

/* ── Sub-tabs ─────────────────────────────────────────────────────────── */

export const SUB_TABS: SubTab[] = [
  { id: 'power', label: 'Power Curves', icon: TrendingUp },
  { id: 'rarity', label: 'Rarity Flow', icon: Layers },
  { id: 'affixes', label: 'Affix Saturation', icon: BarChart3 },
  { id: 'alerts', label: 'Balance Alerts', icon: AlertTriangle },
];
