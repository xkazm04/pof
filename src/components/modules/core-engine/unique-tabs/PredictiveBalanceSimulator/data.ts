import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
} from '@/lib/chart-colors';

export {
  type BalanceReport,
  type HeatmapCell,
  type SurvivalCurvePoint,
  type SensitivityCurve,
  type PredictiveBalanceConfig,
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
} from '@/lib/combat/predictive-balance';

export { ENEMY_ARCHETYPES, GEAR_LOADOUTS } from '@/lib/combat/definitions';

export const ACCENT = MODULE_COLORS.core;

export const ENCOUNTER_COLORS = [ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD];

export const SENS_COLORS: Record<string, string> = {
  attackPower: ACCENT_ORANGE,
  armor: ACCENT_EMERALD,
  maxHealth: STATUS_ERROR,
  critChance: ACCENT_VIOLET,
};

export const SEVERITY_ICON_COLORS: Record<string, string> = {
  critical: STATUS_ERROR,
  warning: STATUS_WARNING,
  info: STATUS_INFO,
};

export function survivalColor(rate: number): string {
  if (rate >= 0.8) return STATUS_SUCCESS;
  if (rate >= 0.5) return STATUS_WARNING;
  return STATUS_ERROR;
}

export function survivalBg(rate: number): string {
  const r = Math.round(255 * (1 - rate));
  const g = Math.round(255 * rate);
  return `rgba(${r}, ${g}, 60, 0.25)`;
}
