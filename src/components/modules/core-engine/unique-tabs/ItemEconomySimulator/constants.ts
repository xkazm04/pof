import {
  TrendingUp, Layers, BarChart3, AlertTriangle,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { SubTab } from '../_shared';
import type { ItemRarity } from '@/types/economy-simulator';

/* ── Accent ───────────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_ORANGE;

/* ── Rarity colors ────────────────────────────────────────────────────── */

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: STATUS_NEUTRAL,
  uncommon: STATUS_SUCCESS,
  rare: MODULE_COLORS.core,
  epic: ACCENT_VIOLET,
  legendary: STATUS_WARNING,
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
