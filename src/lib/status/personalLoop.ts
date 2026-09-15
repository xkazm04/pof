/**
 * Pure helpers for the `/personal-loop` skill — the operator-paired walk over the
 * /status?tab=pipelines map (`.claude/skills/personal-loop/SKILL.md`).
 *
 * Two questions live here so the scripts stay thin and the rules stay tested:
 *  - ORDER: which cell comes next. Column-major over the lanes exactly as the map sorts
 *    them — every pipeline's step 1 top-to-bottom, then every step 2, and so on.
 *  - MOVEMENT: did a recertified cell improve, hold or degrade on the R ladder and the
 *    A axis. Deliberately conservative — an ambiguous reading resolves to `degraded`
 *    (which stops the loop for the operator) rather than to progress.
 *
 * No I/O and no DB import; `scripts/personal-loop/` feeds it real lanes.
 */
import { rank, type ReadinessLevel, type ReadinessState } from './readiness';
import { craftRank, type CraftLevel, type CraftState } from './craft';

export interface WalkItem {
  /** 1-based position in the walk. */
  n: number;
  /** 1-based step index inside its pipeline. */
  column: number;
  /** 1-based position of the pipeline in the /status lane order at snapshot time. */
  laneRank: number;
  catalogId: string;
  step: string;
}

/** Column-major walk over lanes already in /status order (`sortLanes`). Pure. */
export function columnMajorOrder(lanes: ReadonlyArray<{ catalogId: string; cells: ReadonlyArray<{ label: string }> }>): WalkItem[] {
  const out: WalkItem[] = [];
  const width = lanes.reduce((m, l) => Math.max(m, l.cells.length), 0);
  for (let col = 0; col < width; col++) {
    lanes.forEach((lane, i) => {
      const cell = lane.cells[col];
      if (!cell) return;
      out.push({ n: out.length + 1, column: col + 1, laneRank: i + 1, catalogId: lane.catalogId, step: cell.label });
    });
  }
  return out;
}

export type Movement = 'improved' | 'held' | 'degraded' | 'baselined' | 'unmeasured';

export interface RReading {
  level: ReadinessLevel;
  state: ReadinessState;
}

export interface AReading {
  level: CraftLevel;
  state: CraftState;
}

/** blocked < waiting < reached — only the last is a rung actually held. */
const STATE_ORDER: Record<ReadinessState, number> = { blocked: 0, waiting: 1, reached: 2 };

const compare = (a: number, b: number): Movement => (b > a ? 'improved' : b < a ? 'degraded' : 'held');

/** R-ladder movement between two readings of the same cell. Pure. */
export function readinessMovement(before: RReading, after: RReading): Movement {
  if (before.state === after.state) return compare(rank(before.level), rank(after.level));
  // Leaving `reached` is never progress, whatever rung the new state claims.
  if (before.state === 'reached') return 'degraded';
  // A lifted wait/condemnation counts only if the rung it now holds did not drop.
  if (after.state === 'reached') return rank(after.level) >= rank(before.level) ? 'improved' : 'degraded';
  return compare(STATE_ORDER[before.state], STATE_ORDER[after.state]);
}

/** A real gauge = a level was measured against the current content and lens. */
const isRealGauge = (r?: AReading): r is AReading => !!r && r.level !== 'A0' && r.state !== 'stale';

/** A-axis movement. `unmeasured` = the recertify did not produce a current gauge; `baselined`
 *  = there was nothing honest to compare against, so this is the first real reading. Pure. */
export function craftMovement(before: AReading | undefined, after: AReading | undefined): Movement {
  if (!isRealGauge(after)) return 'unmeasured';
  if (!isRealGauge(before)) return 'baselined';
  return compare(craftRank(before.level), craftRank(after.level));
}

const PRECEDENCE: Movement[] = ['degraded', 'unmeasured', 'improved', 'baselined', 'held'];

/** One headline for the item: the worst-news axis wins. Pure. */
export function overallMovement(r: Movement, a: Movement): Movement {
  return PRECEDENCE.find((m) => m === r || m === a) ?? 'held';
}

/** Vault note basename for one cell. Pure. */
export function itemSlug(catalogId: string, step: string): string {
  const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${kebab(catalogId)}--${kebab(step)}`;
}
