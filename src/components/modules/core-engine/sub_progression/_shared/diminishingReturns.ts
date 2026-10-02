/**
 * The ONE diminishing-returns law for the Progression Analysis tab.
 *
 * Every DR number the tab shows (per-card preview, Linear-vs-Diminished chart,
 * visualizer marginals) and every DR file it hands to UE (UCurveTable CSV,
 * DataTable JSON, the C++ GetEffectiveBonus fallback) is derived here, so the
 * preview and the engine cannot disagree.
 *
 * Law: each point up to the soft cap pays `baseValuePerPoint` (1:1). Point p
 * past the cap pays `baseValuePerPoint * lerp(1, postCapMultiplier, t)` with
 * t = (p - softCap) / (100 - softCap), clamped to [0, 1] - a UCurveTable
 * clamps past its last key, so the falloff floors at `postCapMultiplier`.
 *
 * DOM-free on purpose so it can be unit-tested in isolation.
 */
import { STATUS_ERROR, ACCENT_CYAN, ACCENT_EMERALD } from '@/lib/chart-colors';

export interface DRConfig {
  attribute: string;
  /** Display colour for this attribute across the Analysis tab. */
  color: string;
  softCap: number;
  baseValuePerPoint: number;
  postCapMultiplier: number;
  /** The UCurveTable asset holding this attribute's row (one table for all). */
  curveTableName: string;
}

export interface DRAttribute {
  name: string;
  color: string;
  softCap: number;
  curve: { points: number; marginalValue: number }[];
}

/** The single UCurveTable the CSV export is imported as. */
export const DR_CURVE_TABLE_NAME = 'CT_AttributeScaling';
export const DR_CURVE_TABLE_DIR = '/Game/Data/CurveTables';
/** Object path a DataTable row uses to reference the table. */
export const DR_CURVE_TABLE_PATH = `${DR_CURVE_TABLE_DIR}/${DR_CURVE_TABLE_NAME}.${DR_CURVE_TABLE_NAME}`;

/** The allocation range the falloff is authored over. */
export const DR_MAX_POINTS = 100;

export const DR_CONFIGS: DRConfig[] = [
  { attribute: 'Strength', color: STATUS_ERROR, softCap: 60, baseValuePerPoint: 2.0, postCapMultiplier: 0.4, curveTableName: DR_CURVE_TABLE_NAME },
  { attribute: 'Dexterity', color: ACCENT_EMERALD, softCap: 50, baseValuePerPoint: 0.005, postCapMultiplier: 0.35, curveTableName: DR_CURVE_TABLE_NAME },
  { attribute: 'Intelligence', color: ACCENT_CYAN, softCap: 70, baseValuePerPoint: 5.0, postCapMultiplier: 0.5, curveTableName: DR_CURVE_TABLE_NAME },
];

/** Multiplier paid by the `pts`-th allocated point (1 up to the soft cap). */
export function drMultiplierAt(cfg: DRConfig, pts: number): number {
  if (pts <= cfg.softCap) return 1;
  const maxOver = DR_MAX_POINTS - cfg.softCap;
  const t = maxOver > 0 ? Math.min((pts - cfg.softCap) / maxOver, 1) : 1;
  return 1 + (cfg.postCapMultiplier - 1) * t;
}

/** Total bonus for `pts` allocated points: the sum of each point's value. */
export function drEffectiveBonus(cfg: DRConfig, pts: number): number {
  const whole = Math.max(0, Math.floor(pts));
  const preCap = Math.min(whole, Math.max(0, cfg.softCap));
  let total = preCap * cfg.baseValuePerPoint;
  for (let p = preCap + 1; p <= whole; p++) total += cfg.baseValuePerPoint * drMultiplierAt(cfg, p);
  return total;
}

/** Per-point value sampled every `step` points from `step` to 100. */
export function drMarginalSeries(cfg: DRConfig, step = 10): DRAttribute['curve'] {
  const out: DRAttribute['curve'] = [];
  for (let pts = step; pts <= DR_MAX_POINTS; pts += step) {
    out.push({ points: pts, marginalValue: cfg.baseValuePerPoint * drMultiplierAt(cfg, pts) });
  }
  return out;
}

/** The visualizer dataset for a set of configs. */
export function drAttributesFrom(configs: DRConfig[]): DRAttribute[] {
  return configs.map(cfg => ({
    name: cfg.attribute, color: cfg.color, softCap: cfg.softCap, curve: drMarginalSeries(cfg, 10),
  }));
}

/**
 * The one curve-table asset every config references. A config naming a
 * different table would export a DataTable row pointing at an asset the CSV
 * never creates, so drift is a programming error, not a silent export.
 */
export function drCurveTableName(configs: DRConfig[]): string {
  const drifted = configs.filter(c => c.curveTableName !== DR_CURVE_TABLE_NAME);
  if (drifted.length > 0) {
    throw new Error(
      `DR configs must all reference ${DR_CURVE_TABLE_NAME}; got ${drifted.map(c => `${c.attribute} -> ${c.curveTableName}`).join(', ')}`,
    );
  }
  return DR_CURVE_TABLE_NAME;
}

/**
 * UCurveTable CSV: a key header row (`Name,0,5,...,100`, plus any in-range
 * soft cap so the kink is exact under linear interpolation) and one row per
 * attribute, named exactly as `FindCurve(AttributeName)` looks it up.
 */
export function drCurveTableCSV(configs: DRConfig[], step = 5): string {
  drCurveTableName(configs);
  const keys = new Set<number>();
  for (let k = 0; k <= DR_MAX_POINTS; k += step) keys.add(k);
  for (const c of configs) {
    if (Number.isInteger(c.softCap) && c.softCap > 0 && c.softCap < DR_MAX_POINTS) keys.add(c.softCap);
  }
  const sorted = [...keys].sort((a, b) => a - b);
  const rows = [['Name', ...sorted.map(String)].join(',')];
  for (const c of configs) {
    rows.push([c.attribute, ...sorted.map(k => drMultiplierAt(c, k).toFixed(4))].join(','));
  }
  return rows.join('\n');
}
