import type { PredictiveBalanceConfig } from '@/lib/combat/predictive-balance';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  MODULE_COLORS, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
} from '@/lib/chart-colors';

export {
  type BalanceReport,
  type CanonCheckStatus,
  type HeatmapCell,
  type SurvivalCurvePoint,
  type SensitivityCurve,
  type PredictiveBalanceConfig,
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
} from '@/lib/combat/predictive-balance';

export { ENEMY_ARCHETYPES, ENEMY_ARCHETYPE_BY_ID, GEAR_LOADOUTS } from '@/lib/combat/definitions';

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

/** Player-level bounds the Level Range inputs advertise AND the sweep enforces. */
export const SWEEP_LEVEL_BOUNDS: readonly [number, number] = [1, 50];
/** Enemies-per-encounter bounds the count inputs advertise AND the sweep enforces. */
export const SWEEP_COUNT_BOUNDS: readonly [number, number] = [1, 10];

const clampInt = (v: number, [lo, hi]: readonly [number, number]) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;

/**
 * Reconcile typed inputs at commit time (Run), not per keystroke: an input's
 * `min`/`max` attributes do not stop a typed value, so a "1000" upper level
 * would otherwise sweep hundreds of levels, a "0" count an empty encounter, and
 * an inverted range zero levels. Returns the same object when already in bounds.
 */
export function boundSweepConfig(config: PredictiveBalanceConfig): PredictiveBalanceConfig {
  const a = clampInt(config.levelRange[0], SWEEP_LEVEL_BOUNDS);
  const b = clampInt(config.levelRange[1], SWEEP_LEVEL_BOUNDS);
  const levelRange: [number, number] = [Math.min(a, b), Math.max(a, b)];
  const counts = config.enemyConfigs.map(ec => clampInt(ec.count, SWEEP_COUNT_BOUNDS));
  const levelsSame = levelRange[0] === config.levelRange[0] && levelRange[1] === config.levelRange[1];
  const countsSame = counts.every((n, i) => n === config.enemyConfigs[i].count);
  if (levelsSame && countsSame) return config;
  return {
    ...config,
    levelRange,
    enemyConfigs: countsSame
      ? config.enemyConfigs
      : config.enemyConfigs.map((ec, i) => ({ ...ec, count: counts[i] })),
  };
}

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
