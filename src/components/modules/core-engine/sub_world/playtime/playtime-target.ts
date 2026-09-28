/**
 * Playtime budget targeting + interest-curve helpers.
 *
 * Pure functions over the world model (`@/lib/world/world-model`) — priced
 * with its single cost table; the static world is the default input.
 * Keep this file logic-only so the React components stay thin.
 */

import {
  computeZonePlaytime,
  computeCumulativePath,
  resolveCosts,
  formatPlaytime,
  type PlaytimeCosts,
  type WorldModel,
  type ZonePlaytimeEstimate,
  type PlaytimePathMode,
} from '@/lib/world/world-model';
import { bindingChain, type WorldLever } from '@/lib/world/playtime-scenario';
import { STATIC_WORLD } from '../_shared/data';

/** Seconds in 6 hours — the recommendation in the requirement. */
export const DEFAULT_TARGET_SEC = 6 * 3600;
/** Slider bounds — 30 min to 12 h. */
export const TARGET_MIN_SEC = 30 * 60;
export const TARGET_MAX_SEC = 12 * 3600;

/** ±10% of target is "on budget" — outside that we flag. */
export const BUDGET_TOLERANCE = 0.10;

/** Bands used by the interest curve. */
export const GRIND_THRESHOLD = 0.70;
export const DEAD_THRESHOLD = 0.20;

/** Per-zone intensity in [0,1]. Combat density + a 1.5× boss weight. */
export function intensityScore(zp: ZonePlaytimeEstimate): number {
  if (zp.totalSec <= 0) return 0;
  const combat = zp.combatSec / zp.totalSec;
  const boss = (zp.bossSec / zp.totalSec) * 1.5;
  return Math.max(0, Math.min(1, combat + boss));
}

export type ZoneFlag = 'over' | 'under' | 'on';

export function classifyZone(actualSec: number, targetSec: number): ZoneFlag {
  if (targetSec <= 0) return 'on';
  const lo = targetSec * (1 - BUDGET_TOLERANCE);
  const hi = targetSec * (1 + BUDGET_TOLERANCE);
  if (actualSec > hi) return 'over';
  if (actualSec < lo) return 'under';
  return 'on';
}

/** A zone on the path with the inputs its budget is allocated from. */
export interface BudgetZone {
  zoneId: string;
  levelMin: number;
  levelMax: number;
  totalSec: number;
}

export interface ZoneBudget {
  zoneId: string;
  budgetSec: number;
  actualSec: number;
  flag: ZoneFlag;
}

/**
 * Split a path target across its zones by level span (levelMax − levelMin + 1):
 * the minutes-per-level reading of a progression budget. A zone's budget does
 * not depend on its current time, so over / under / on can single a zone out.
 */
export function allocateZoneBudgets(zones: readonly BudgetZone[], targetSec: number): ZoneBudget[] {
  const span = (z: BudgetZone) => Math.max(1, z.levelMax - z.levelMin + 1);
  const totalSpan = zones.reduce((s, z) => s + span(z), 0);
  return zones.map((z) => {
    const budgetSec = totalSpan > 0 ? (targetSec * span(z)) / totalSpan : 0;
    return { zoneId: z.zoneId, budgetSec, actualSec: z.totalSec, flag: classifyZone(z.totalSec, budgetSec) };
  });
}

/** Concrete designer-actionable lever for an over/under zone — applicable as data (`applyLevers`). */
export interface Lever extends WorldLever {
  label: string;
  detail: string;
  savesSec: number;
}

/**
 * Suggest concrete levers to close the gap between an over/under zone and its
 * per-zone budget (`allocateZoneBudgets`). Levers reflect the dominant cost driver in that zone:
 *  - combat-heavy → drop enemy spawns
 *  - boss-heavy   → cut a boss phase
 *  - exploration-heavy → shorten traversal / cut side encounters
 *
 * Returned levers are *order-preserving* (most-impactful first) and capped at 3.
 */
export function suggestLevers(
  zp: ZonePlaytimeEstimate, targetZoneSec: number, costs?: Partial<PlaytimeCosts>,
): Lever[] {
  const { secPerEnemy, secPerBossPhase } = resolveCosts(costs);
  const enemies = zp.enemyCount ?? 0;
  const delta = zp.totalSec - targetZoneSec;
  const out: Lever[] = [];
  const absDelta = Math.abs(delta);

  if (delta > 0) {
    // Over budget — propose cuts
    const totalNonExp = zp.combatSec + zp.bossSec || 1;
    const combatShare = zp.combatSec / totalNonExp;
    const bossShare = zp.bossSec / totalNonExp;
    // Combat lever (only if zone has enemies)
    if (zp.combatSec > 0) {
      const dropEnemies = Math.min(enemies, Math.ceil((absDelta * combatShare) / secPerEnemy));
      if (dropEnemies > 0) {
        out.push({
          zoneId: zp.zoneId, kind: 'enemies', amount: -dropEnemies,
          label: `Drop ${dropEnemies} enemy spawn${dropEnemies === 1 ? '' : 's'}`,
          detail: `${enemies} → ${enemies - dropEnemies} (saves ${formatPlaytime(dropEnemies * secPerEnemy)})`,
          savesSec: dropEnemies * secPerEnemy,
        });
      }
    }
    if (zp.bossSec > 0) {
      const phases = zp.bossSec / secPerBossPhase;
      const dropPhases = Math.min(Math.floor(phases) - 1, Math.ceil((absDelta * bossShare) / secPerBossPhase));
      if (dropPhases > 0) {
        out.push({
          zoneId: zp.zoneId, kind: 'bossPhases', amount: -dropPhases,
          label: `Cut ${dropPhases} boss phase${dropPhases === 1 ? '' : 's'}`,
          detail: `${phases} → ${phases - dropPhases} phases (saves ${formatPlaytime(dropPhases * secPerBossPhase)})`,
          savesSec: dropPhases * secPerBossPhase,
        });
      }
    }
    // Exploration trim — always available
    const explTrim = Math.min(zp.explorationSec - 60, Math.ceil(absDelta * 0.3));
    if (explTrim >= 30) {
      out.push({
        zoneId: zp.zoneId, kind: 'exploration', amount: -explTrim,
        label: `Shorten traversal by ${formatPlaytime(explTrim)}`,
        detail: `Cut side encounters / shorter critical-path route`,
        savesSec: explTrim,
      });
    }
  } else {
    // Under budget — propose adds
    const addEnemies = Math.ceil(absDelta / secPerEnemy);
    if (addEnemies > 0 && absDelta > 30) {
      out.push({
        zoneId: zp.zoneId, kind: 'enemies', amount: addEnemies,
        label: `Add ${addEnemies} enemy spawn${addEnemies === 1 ? '' : 's'}`,
        detail: zp.combatMeasured
          ? `${enemies} → ${enemies + addEnemies} (adds ${formatPlaytime(addEnemies * secPerEnemy)})`
          : `combat not measured → ${addEnemies} (adds ${formatPlaytime(addEnemies * secPerEnemy)})`,
        savesSec: -addEnemies * secPerEnemy,
      });
    }
    if (zp.bossSec === 0 && absDelta > 120) {
      out.push({
        zoneId: zp.zoneId, kind: 'bossPhases', amount: 1,
        label: `Introduce a mini-boss (1 phase)`,
        detail: `Adds ${formatPlaytime(secPerBossPhase)} of high-intensity pacing`,
        savesSec: -secPerBossPhase,
      });
    }
    if (absDelta > 60) {
      out.push({
        zoneId: zp.zoneId, kind: 'sideBeat', amount: Math.min(absDelta, 180),
        label: `Add an optional side beat (${formatPlaytime(Math.min(absDelta, 180))})`,
        detail: `Side quest, environmental puzzle, or lore moment`,
        savesSec: -Math.min(absDelta, 180),
      });
    }
  }

  return out.slice(0, 3);
}

/** One targeter row: the scenario's time vs its budget, with levers sized on the baseline. */
export interface BudgetRow extends ZoneBudget {
  zoneName: string;
  baselineSec: number;
  /** Sized against the BASELINE, so a Try-ed lever keeps its identity (and its Undo) while applied. */
  levers: Lever[];
}

export interface BudgetReport {
  /** Zone ids of the chain that sets the scenario's path total (the budget is split across these). */
  chain: string[];
  rows: BudgetRow[];
}

/**
 * Per-zone budgets for a what-if scenario. The target is split by level span
 * over the scenario's binding chain; a zone is listed when it is off budget in
 * the scenario or the baseline, or carries an applied lever.
 */
export function buildBudgetReport(
  world: WorldModel, baseline: WorldModel, mode: PlaytimePathMode, targetSec: number,
  applied: readonly WorldLever[], costs?: Partial<PlaytimeCosts>,
): BudgetReport {
  const chain = bindingChain(computeCumulativePath(world, mode, costs));
  const zoneById = new Map(world.zones.map((z) => [z.id, z]));
  const scen = new Map(computeZonePlaytime(world, costs).map((p) => [p.zoneId, p]));
  const base = new Map(computeZonePlaytime(baseline, costs).map((p) => [p.zoneId, p]));
  const budgets = allocateZoneBudgets(chain.flatMap((id) => {
    const z = zoneById.get(id);
    return z ? [{ zoneId: id, levelMin: z.levelMin, levelMax: z.levelMax, totalSec: scen.get(id)?.totalSec ?? 0 }] : [];
  }), targetSec);
  const rows = budgets.flatMap((b): BudgetRow[] => {
    const baseZp = base.get(b.zoneId);
    const baselineSec = baseZp?.totalSec ?? 0;
    const listed = b.flag !== 'on' || classifyZone(baselineSec, b.budgetSec) !== 'on' || applied.some((l) => l.zoneId === b.zoneId);
    if (!listed) return [];
    const zoneName = zoneById.get(b.zoneId)?.name ?? b.zoneId;
    return [{ ...b, zoneName, baselineSec, levers: baseZp ? suggestLevers(baseZp, b.budgetSec, costs) : [] }];
  });
  return { chain, rows };
}

/** Walk the cumulative critical/all-paths nodes in time order; tag each with intensity + grind/dead band. */
export interface InterestPoint {
  zoneId: string;
  zoneName: string;
  cumulativeSec: number;
  zoneSec: number;
  intensity: number;
  band: 'grind' | 'dead' | 'mid';
}

/**
 * Interest points along a world's cumulative path. `buildInterestPoints(mode)`
 * prices the static world; pass any WorldModel (a generated candidate, a what-if
 * scenario) as `buildInterestPoints(world, mode, costs?)`.
 */
export function buildInterestPoints(mode: PlaytimePathMode): InterestPoint[];
export function buildInterestPoints(world: WorldModel, mode: PlaytimePathMode, costs?: Partial<PlaytimeCosts>): InterestPoint[];
export function buildInterestPoints(
  worldOrMode: WorldModel | PlaytimePathMode, modeArg?: PlaytimePathMode, costs?: Partial<PlaytimeCosts>,
): InterestPoint[] {
  const world = typeof worldOrMode === 'string' ? STATIC_WORLD : worldOrMode;
  const mode = typeof worldOrMode === 'string' ? worldOrMode : modeArg ?? 'critical';
  const playtimeByZoneId = new Map(computeZonePlaytime(world, costs).map(p => [p.zoneId, p]));
  return computeCumulativePath(world, mode, costs).nodes.map((n) => {
    const zp = playtimeByZoneId.get(n.zoneId);
    const intensity = zp ? intensityScore(zp) : 0;
    const band: InterestPoint['band'] =
      intensity >= GRIND_THRESHOLD ? 'grind'
      : intensity <= DEAD_THRESHOLD ? 'dead'
      : 'mid';
    return {
      zoneId: n.zoneId, zoneName: n.zoneName,
      cumulativeSec: n.cumulativeSec, zoneSec: n.zoneSec,
      intensity, band,
    };
  });
}

/** Detect contiguous grind walls (≥3 consecutive grind) and dead spots (≥2 consecutive dead). */
export interface PacingRegion {
  kind: 'grind' | 'dead';
  fromIdx: number;
  toIdx: number;
  zoneNames: string[];
}

export function detectPacingRegions(points: InterestPoint[]): PacingRegion[] {
  const out: PacingRegion[] = [];
  let i = 0;
  while (i < points.length) {
    const b = points[i].band;
    if (b === 'grind' || b === 'dead') {
      let j = i;
      while (j + 1 < points.length && points[j + 1].band === b) j++;
      const len = j - i + 1;
      const threshold = b === 'grind' ? 3 : 2;
      if (len >= threshold) {
        out.push({
          kind: b,
          fromIdx: i, toIdx: j,
          zoneNames: points.slice(i, j + 1).map(p => p.zoneName),
        });
      }
      i = j + 1;
    } else i++;
  }
  return out;
}
