/**
 * Playtime budget targeting + interest-curve helpers.
 *
 * Pure functions over the canonical ZONE_PLAYTIME / CRITICAL_PATH data —
 * keep this file logic-only so the React components stay thin.
 */

import {
  ZONE_PLAYTIME,
  CRITICAL_PATH,
  ALL_PATHS,
  formatPlaytime,
  type ZonePlaytimeEstimate,
  type PlaytimePathMode,
  type CumulativeNode,
} from '../_shared/data';

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

/** Per-second cost knobs (mirror data.ts internals; intentionally duplicated to keep this file self-contained). */
const SEC_PER_ENEMY = 8;
const SEC_PER_BOSS_PHASE = 90;

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

/** Concrete designer-actionable lever for an over/under zone. */
export interface Lever {
  label: string;
  detail: string;
  savesSec: number;
}

/**
 * Suggest concrete levers to close the gap between an over/under zone and its
 * per-zone budget. Levers reflect the dominant cost driver in that zone:
 *  - combat-heavy → drop enemy spawns
 *  - boss-heavy   → cut a boss phase
 *  - exploration-heavy → shorten traversal / cut side encounters
 *
 * Returned levers are *order-preserving* (most-impactful first) and capped at 3.
 */
export function suggestLevers(zp: ZonePlaytimeEstimate, targetZoneSec: number): Lever[] {
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
      const dropEnemies = Math.min(zp.enemyCount, Math.ceil((absDelta * combatShare) / SEC_PER_ENEMY));
      if (dropEnemies > 0) {
        out.push({
          label: `Drop ${dropEnemies} enemy spawn${dropEnemies === 1 ? '' : 's'}`,
          detail: `${zp.enemyCount} → ${zp.enemyCount - dropEnemies} (saves ${formatPlaytime(dropEnemies * SEC_PER_ENEMY)})`,
          savesSec: dropEnemies * SEC_PER_ENEMY,
        });
      }
    }
    if (zp.bossSec > 0) {
      const phases = zp.bossSec / SEC_PER_BOSS_PHASE;
      const dropPhases = Math.min(Math.floor(phases) - 1, Math.ceil((absDelta * bossShare) / SEC_PER_BOSS_PHASE));
      if (dropPhases > 0) {
        out.push({
          label: `Cut ${dropPhases} boss phase${dropPhases === 1 ? '' : 's'}`,
          detail: `${phases} → ${phases - dropPhases} phases (saves ${formatPlaytime(dropPhases * SEC_PER_BOSS_PHASE)})`,
          savesSec: dropPhases * SEC_PER_BOSS_PHASE,
        });
      }
    }
    // Exploration trim — always available
    const explTrim = Math.min(zp.explorationSec - 60, Math.ceil(absDelta * 0.3));
    if (explTrim >= 30) {
      out.push({
        label: `Shorten traversal by ${formatPlaytime(explTrim)}`,
        detail: `Cut side encounters / shorter critical-path route`,
        savesSec: explTrim,
      });
    }
  } else {
    // Under budget — propose adds
    const addEnemies = Math.ceil(absDelta / SEC_PER_ENEMY);
    if (addEnemies > 0 && absDelta > 30) {
      out.push({
        label: `Add ${addEnemies} enemy spawn${addEnemies === 1 ? '' : 's'}`,
        detail: `${zp.enemyCount} → ${zp.enemyCount + addEnemies} (adds ${formatPlaytime(addEnemies * SEC_PER_ENEMY)})`,
        savesSec: -addEnemies * SEC_PER_ENEMY,
      });
    }
    if (zp.bossSec === 0 && absDelta > 120) {
      out.push({
        label: `Introduce a mini-boss (1 phase)`,
        detail: `Adds ${formatPlaytime(SEC_PER_BOSS_PHASE)} of high-intensity pacing`,
        savesSec: -SEC_PER_BOSS_PHASE,
      });
    }
    if (absDelta > 60) {
      out.push({
        label: `Add an optional side beat (${formatPlaytime(Math.min(absDelta, 180))})`,
        detail: `Side quest, environmental puzzle, or lore moment`,
        savesSec: -Math.min(absDelta, 180),
      });
    }
  }

  return out.slice(0, 3);
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

const playtimeByZoneId = new Map(ZONE_PLAYTIME.map(p => [p.zoneId, p]));

export function buildInterestPoints(mode: PlaytimePathMode): InterestPoint[] {
  const path = mode === 'critical' ? CRITICAL_PATH : ALL_PATHS;
  return path.nodes.map((n: CumulativeNode) => {
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
