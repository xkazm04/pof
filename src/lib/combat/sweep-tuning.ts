/**
 * Tune from the heatmap — solve ONE sweep cell's tuning lever to a target
 * survival, refuse honestly when that cannot be done, and diff two sweeps.
 *
 * The solve narrows the sweep config to the one cell (its level, its
 * encounter, no sensitivity steps). A cell seeds its engine run from
 * (archetype, level) alone, so the narrowed run IS the full-sweep cell and a
 * solved value reproduces when the whole grid is re-run with it
 * (game-production/encounter-balance-simulation#per-cell-seed-derivation-for-order-independence).
 *
 * Every metric evaluation is one `runPredictiveBalanceAsync` job: it yields
 * before its first fight and inside the cell, and honours the caller's
 * AbortSignal at every yield, so a solve never pins the UI thread and Cancel
 * lands at once. The bisection is still the shared `solveFor` — driven by
 * REPLAY: `solveFor` runs synchronously over a memo of evaluated lever values;
 * when it asks for a value not in the memo it is interrupted, that value is
 * evaluated on the job, and `solveFor` is re-run from the top. It is
 * deterministic in its inputs, so each replay retraces the same path one step
 * further; the cost is one engine job per distinct lever value, exactly as a
 * direct solve.
 *
 * Sweep before solve (#goal-seek-on-a-seeded-monotonic-lever): a coarse
 * 5-point pre-sweep over the lever range comes first. A non-monotonic curve or
 * an out-of-range target is REFUSED with the sweep's own numbers — never
 * bisected into a meaningless value.
 */

import { solveFor } from '@/lib/balance/goal-seek';
import type { CombatLever } from '@/lib/combat/goal-seek';
import { ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';
import {
  runPredictiveBalanceAsync,
  type BalanceReport,
  type BalanceReportAlert,
  type CanonCheckStatus,
  type HeatmapCell,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import type { ArchetypeRegistry, EnemySourceReport } from '@/lib/combat/simulation-engine';

// ── Levers ─────────────────────────────────────────────────────────────────

export interface CombatTuningLever {
  lever: CombatLever;
  label: string;
  /** Solve band. Player-side levers keep the slider band; enemy HP/damage reach 8x, since a sweep of 100% cells needs far more than 2x to bite. */
  range: [number, number];
}

export const COMBAT_TUNING_LEVERS: readonly CombatTuningLever[] = [
  { lever: 'enemyHealthMul', label: 'Enemy HP', range: [0.5, 8] },
  { lever: 'enemyDamageMul', label: 'Enemy damage', range: [0.5, 8] },
  { lever: 'playerHealthMul', label: 'Player HP', range: [0.5, 2] },
  { lever: 'playerDamageMul', label: 'Player damage', range: [0.5, 2] },
  { lever: 'playerArmorMul', label: 'Player armor', range: [0.5, 2] },
  { lever: 'critMultiplierMul', label: 'Crit multiplier', range: [0.5, 2] },
  { lever: 'armorEffectivenessWeight', label: 'Armor effectiveness', range: [0.5, 2] },
  { lever: 'healingMul', label: 'Healing', range: [0.5, 2] },
];

export function leverInfo(lever: CombatLever): CombatTuningLever {
  return COMBAT_TUNING_LEVERS.find(l => l.lever === lever) ?? { lever, label: lever, range: [0.5, 2] };
}

// ── Cell solve ─────────────────────────────────────────────────────────────

/** A heatmap cell by position: player level x `config.enemyConfigs` index. */
export interface SweepCellRef {
  level: number;
  encounterIndex: number;
}

type SweepEnemies = { registry: ArchetypeRegistry; provenance?: EnemySourceReport };

export interface CellSolveResult {
  lever: CombatLever;
  target: number;
  range: [number, number];
  /** The lever value to apply; null when the solve was refused. */
  solvedValue: number | null;
  /** The cell's survival at `solvedValue`; null when refused. */
  achieved: number | null;
  /** `achieved` is within tolerance of the target (max(solver default, 1/iterations)). */
  converged: boolean;
  /** false = refused: the target is unreachable or the lever is not monotonic here. */
  applicable: boolean;
  /** Engine evaluations run (pre-sweep included). */
  evals: number;
  reason: string;
  /** The coarse pre-sweep the verdict rests on. */
  preSweep: { value: number; survival: number }[];
}

export type CellSolveOutcome = CellSolveResult | { aborted: true };

export interface CellSolveOptions {
  /** Override the lever's solve band. */
  range?: [number, number];
  /** Aborting resolves `{ aborted: true }` at the job's next yield; nothing is solved. */
  signal?: AbortSignal;
  /** `k` (1-based) as engine evaluation k starts. */
  onEval?: (k: number) => void;
}

/** Thrown by the memo metric when `solveFor` asks for a lever value not yet evaluated. */
class NeedsEval {
  constructor(readonly value: number) {}
}

const pct = (x: number) => `${+(x * 100).toFixed(1)}%`;
const num = (x: number) => `${+x.toFixed(3)}`;

/** The sweep config narrowed to one cell, or null when the encounter does not exist. */
export function narrowToCell(config: PredictiveBalanceConfig, cell: SweepCellRef): PredictiveBalanceConfig | null {
  const ec = config.enemyConfigs[cell.encounterIndex];
  if (!ec) return null;
  return { ...config, levelRange: [cell.level, cell.level], levelStep: 1, enemyConfigs: [ec], sensitivityAttributes: [] };
}

/**
 * Solve `lever` so the cell's survival hits `target` (0–1), on the sweep job.
 * Resolves the verdict (solved, not converged, or refused with the reason), or
 * `{ aborted: true }` if `opts.signal` fired — never a partial value.
 */
export async function solveCellTuning(
  config: PredictiveBalanceConfig,
  enemies: SweepEnemies | undefined,
  cell: SweepCellRef,
  lever: CombatLever,
  target: number,
  opts: CellSolveOptions = {},
): Promise<CellSolveOutcome> {
  const { label, range: band } = leverInfo(lever);
  const [lo, hi] = opts.range ?? band;
  const [min, max] = lo <= hi ? [lo, hi] : [hi, lo];
  const memo = new Map<number, number>();
  const preSweep: CellSolveResult['preSweep'] = [];
  const verdict = (v: Partial<CellSolveResult> & { reason: string }): CellSolveResult => ({
    lever, target, range: [min, max], solvedValue: null, achieved: null,
    converged: false, applicable: false, evals: memo.size, preSweep, ...v,
  });

  const narrowed = narrowToCell(config, cell);
  const ec = config.enemyConfigs[cell.encounterIndex];
  if (!narrowed || !ec) return verdict({ reason: `This sweep has no encounter #${cell.encounterIndex + 1}.` });
  if (!(enemies?.registry ?? ENEMY_ARCHETYPE_BY_ID).get(ec.archetypeId)) {
    return verdict({ reason: `Archetype '${ec.archetypeId}' does not resolve, so the cell cannot be simulated.` });
  }
  // A survival rate moves in steps of 1/iterations; demanding less than one step
  // cannot converge. The epsilon absorbs float error in k/n - target.
  const tolerance = Math.max(1e-6, Math.abs(target) * 0.005, 1 / config.iterations) + 1e-9;

  /** One engine job at `value`; null when aborted. */
  const evaluate = async (value: number): Promise<number | null> => {
    opts.onEval?.(memo.size + 1);
    const tuning = { ...config.tuning, [lever]: value };
    const r = await runPredictiveBalanceAsync({ ...narrowed, tuning }, enemies, { signal: opts.signal });
    if (r.aborted) return null;
    const survival = r.heatmap[0]?.survivalRate ?? 0;
    memo.set(value, survival);
    return survival;
  };

  // 1. Sweep before solve.
  // Endpoints and midpoint spelled the way `solveFor` computes them, so its first
  // three evaluations are memo hits.
  const points = [min, min + (max - min) / 4, (min + max) / 2, min + (3 * (max - min)) / 4, max];
  for (const value of points) {
    const survival = await evaluate(value);
    if (survival === null) return { aborted: true };
    preSweep.push({ value, survival });
  }
  const f = preSweep.map(p => p.survival);
  const steps = f.slice(1).map((y, i) => y - f[i]);
  const shown = `${label} ${preSweep.map(p => `${num(p.value)}→${pct(p.survival)}`).join(', ')}`;
  if (steps.some(d => d > tolerance) && steps.some(d => d < -tolerance)) {
    return verdict({
      reason: `Survival is not monotonic over [${num(min)}, ${num(max)}] at this cell (${shown}); ` +
        'a bisection would chase the fold, so nothing was solved.',
    });
  }
  const fLo = Math.min(...f);
  const fHi = Math.max(...f);
  if (target < fLo - tolerance || target > fHi + tolerance) {
    return verdict({
      reason: `Target ${pct(target)} is outside the achievable range [${pct(fLo)}, ${pct(fHi)}] for ` +
        `${label} over [${num(min)}, ${num(max)}] at this cell.`,
    });
  }

  // 2. Solve: the shared bisection, replayed over the memo (see the file header).
  for (;;) {
    let res: ReturnType<typeof solveFor>;
    try {
      res = solveFor(target, { min, max }, (v) => {
        const hit = memo.get(v);
        if (hit === undefined) throw new NeedsEval(v);
        return hit;
      }, { tolerance });
    } catch (err) {
      if (!(err instanceof NeedsEval)) throw err;
      if ((await evaluate(err.value)) === null) return { aborted: true };
      continue;
    }
    const from = config.tuning[lever];
    return verdict({
      applicable: true,
      converged: res.converged,
      solvedValue: res.solvedValue,
      achieved: res.achievedMetric,
      reason: res.converged
        ? `${label} ${num(from)} → ${num(res.solvedValue)}: ${pct(res.achievedMetric)} survival ` +
          `(target ${pct(target)}) in ${memo.size} evaluations.`
        : res.reason,
    });
  }
}

// ── Sweep diff ─────────────────────────────────────────────────────────────

export interface SweepCellDelta {
  level: number;
  encounterIndex: number;
  label: string;
  survivalDelta: number;
  ttkDelta: number;
}

export interface CanonFlip {
  lawId: string;
  law: string;
  from: CanonCheckStatus['status'];
  to: CanonCheckStatus['status'];
}

export interface SweepDiff {
  /** Every cell present in both runs, next minus base. */
  cells: SweepCellDelta[];
  /** Alerts (by message) in next but not base / in base but not next. */
  alertsAdded: BalanceReportAlert[];
  alertsRemoved: BalanceReportAlert[];
  /** Canon laws whose status changed. */
  canonFlips: CanonFlip[];
}

const cellKey = (c: HeatmapCell) => `${c.playerLevel}|${c.encounterIndex}|${c.enemyLabel}`;

const uniqueByMessage = (alerts: readonly BalanceReportAlert[]) =>
  alerts.filter((a, i, all) => all.findIndex(b => b.message === a.message) === i);

/** What changed from `base` to `next`: per-cell deltas, alert churn, canon flips. Pure. */
export function diffSweeps(base: BalanceReport, next: BalanceReport): SweepDiff {
  const baseCells = new Map(base.heatmap.map(c => [cellKey(c), c]));
  const cells: SweepCellDelta[] = [];
  for (const c of next.heatmap) {
    const b = baseCells.get(cellKey(c));
    if (!b) continue;
    cells.push({
      level: c.playerLevel, encounterIndex: c.encounterIndex, label: c.enemyLabel,
      survivalDelta: c.survivalRate - b.survivalRate, ttkDelta: c.avgTTK - b.avgTTK,
    });
  }
  const baseMsgs = new Set(base.alerts.map(a => a.message));
  const nextMsgs = new Set(next.alerts.map(a => a.message));
  const baseChecks = new Map(base.canonChecks.map(c => [c.lawId, c]));
  const canonFlips: CanonFlip[] = [];
  for (const c of next.canonChecks) {
    const b = baseChecks.get(c.lawId);
    if (b && b.status !== c.status) canonFlips.push({ lawId: c.lawId, law: c.law, from: b.status, to: c.status });
  }
  return {
    cells,
    alertsAdded: uniqueByMessage(next.alerts).filter(a => !baseMsgs.has(a.message)),
    alertsRemoved: uniqueByMessage(base.alerts).filter(a => !nextMsgs.has(a.message)),
    canonFlips,
  };
}
