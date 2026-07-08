import {
  Heart, Swords, Shield, Flame, Crosshair,
} from 'lucide-react';
import type { ReportBand } from '@/lib/combat/fight-report';
import type {
  TuningOverrides,
  BalanceAlert,
  BalanceAlertSeverity,
  CombatAbility,
} from '@/types/combat-simulator';

// ── Constants ───────────────────────────────────────────────────────────────

export const EMPTY_ALERTS: BalanceAlert[] = [];

/** Plain-language Story Mode vs. full numeric Advanced view. */
export type ViewMode = 'simple' | 'advanced';

export const SEVERITY_STYLE: Record<BalanceAlertSeverity, { bg: string; border: string; text: string }> = {
  info: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400' },
  warning: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400' },
};

/** Difficulty-band styling for the narrated Fight Report Card. */
export const BAND_STYLE: Record<ReportBand, { text: string; bg: string; border: string; label: string }> = {
  easy: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/25', label: 'Too Easy' },
  fair: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25', label: 'Well Balanced' },
  tough: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/25', label: 'Tough' },
  brutal: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/25', label: 'Brutal' },
};

export const TUNING_SLIDERS: { key: keyof TuningOverrides; label: string; icon: typeof Heart }[] = [
  { key: 'playerHealthMul', label: 'Player HP', icon: Heart },
  { key: 'playerDamageMul', label: 'Player Dmg', icon: Swords },
  { key: 'playerArmorMul', label: 'Player Armor', icon: Shield },
  { key: 'enemyHealthMul', label: 'Enemy HP', icon: Heart },
  { key: 'enemyDamageMul', label: 'Enemy Dmg', icon: Flame },
  { key: 'critMultiplierMul', label: 'Crit Multi', icon: Crosshair },
  { key: 'armorEffectivenessWeight', label: 'Armor Weight', icon: Shield },
];

/** Display order + labels for grouping the ability picker by CombatAbility.type. */
export const ABILITY_GROUPS: { type: CombatAbility['type']; label: string }[] = [
  { type: 'melee', label: 'Melee' },
  { type: 'ranged', label: 'Ranged' },
  { type: 'aoe', label: 'AoE' },
  { type: 'buff', label: 'Buff' },
  { type: 'dodge', label: 'Dodge' },
];
