/**
 * Playtime what-if scenarios — pure, IO-free.
 *
 * A `WorldLever` is one designer edit to ONE WorldModel field of ONE zone:
 *   enemies    → enemiesByZoneId        (± enemy spawns)
 *   bossPhases → bossPhasesByZoneId     (± boss phases)
 *   exploration / sideBeat → explorationSecByZoneId (± seconds)
 *
 * `applyLevers(world, levers)` returns a new world (the input is never
 * mutated; no levers returns the input itself), so the same pricing functions
 * (`computeZonePlaytime` / `computeCumulativePath`) reprice a scenario exactly
 * like the baseline. `scenarioReducer` is the Try / Undo / Reset state.
 */

import {
  computeCumulativePath,
  resolveCosts,
  type CumulativePath,
  type PlaytimeCosts,
  type PlaytimePathMode,
  type WorldModel,
} from '@/lib/world/world-model';

export type LeverKind = 'enemies' | 'bossPhases' | 'exploration' | 'sideBeat';

export interface WorldLever {
  zoneId: string;
  kind: LeverKind;
  /** Signed change: enemies / phases for those kinds, seconds for exploration / sideBeat. */
  amount: number;
}

/** Same edit (zone, kind and amount). */
export function sameLever(a: WorldLever, b: WorldLever): boolean {
  return a.zoneId === b.zoneId && a.kind === b.kind && a.amount === b.amount;
}

export function isLeverApplied(applied: readonly WorldLever[], lever: WorldLever): boolean {
  return applied.some((l) => sameLever(l, lever));
}

function bump(map: Readonly<Record<string, number>>, id: string, base: number, amount: number): Record<string, number> {
  return { ...map, [id]: Math.max(0, base + amount) };
}

/** The scenario world: `world` with every lever applied in order. Unknown zones are ignored. */
export function applyLevers(
  world: WorldModel, levers: readonly WorldLever[], costs?: Partial<PlaytimeCosts>,
): WorldModel {
  if (levers.length === 0) return world;
  const c = resolveCosts(costs);
  const typeById = new Map(world.zones.map((z) => [z.id, z.type]));
  let next: WorldModel = world;
  for (const l of levers) {
    const type = typeById.get(l.zoneId);
    if (type === undefined) continue;
    if (l.kind === 'enemies') {
      next = { ...next, enemiesByZoneId: bump(next.enemiesByZoneId, l.zoneId, next.enemiesByZoneId[l.zoneId] ?? 0, l.amount) };
    } else if (l.kind === 'bossPhases') {
      next = { ...next, bossPhasesByZoneId: bump(next.bossPhasesByZoneId, l.zoneId, next.bossPhasesByZoneId[l.zoneId] ?? 0, l.amount) };
    } else {
      const expl = next.explorationSecByZoneId ?? {};
      next = { ...next, explorationSecByZoneId: bump(expl, l.zoneId, expl[l.zoneId] ?? c.explorationSecByType[type], l.amount) };
    }
  }
  return next;
}

export interface ScenarioState {
  applied: readonly WorldLever[];
}

export const EMPTY_SCENARIO: ScenarioState = { applied: [] };

export type ScenarioAction = { type: 'toggle'; lever: WorldLever } | { type: 'reset' };

/**
 * Try / Undo / Reset. Toggling an applied lever removes it (undo); toggling a
 * new one replaces any applied lever of the same zone + kind (one edit per
 * zone field), then appends it.
 */
export function scenarioReducer(state: ScenarioState, action: ScenarioAction): ScenarioState {
  if (action.type === 'reset') return state.applied.length === 0 ? state : EMPTY_SCENARIO;
  const { lever } = action;
  if (isLeverApplied(state.applied, lever)) {
    return { applied: state.applied.filter((l) => !sameLever(l, lever)) };
  }
  const rest = state.applied.filter((l) => !(l.zoneId === lever.zoneId && l.kind === lever.kind));
  return { applied: [...rest, { zoneId: lever.zoneId, kind: lever.kind, amount: lever.amount }] };
}

export interface ScenarioDiff {
  baselineTotalSec: number;
  scenarioTotalSec: number;
  /** scenario − baseline (negative = the scenario is shorter). */
  totalDeltaSec: number;
}

export function diffVsBaseline(
  baseline: WorldModel, scenario: WorldModel, mode: PlaytimePathMode, costs?: Partial<PlaytimeCosts>,
): ScenarioDiff {
  const baselineTotalSec = computeCumulativePath(baseline, mode, costs).totalSec;
  const scenarioTotalSec = computeCumulativePath(scenario, mode, costs).totalSec;
  return { baselineTotalSec, scenarioTotalSec, totalDeltaSec: scenarioTotalSec - baselineTotalSec };
}

const EPS = 1e-6;

/**
 * The zone sequence whose time sets `path.totalSec` (root → latest arrival),
 * recovered by walking back along segments whose arrival is tight. A path
 * target is only meaningful for these zones: a parallel, shorter branch (or a
 * disconnected sub-world) does not move the total.
 */
export function bindingChain(path: CumulativePath): string[] {
  if (path.nodes.length === 0) return [];
  const nodeById = new Map(path.nodes.map((n) => [n.zoneId, n]));
  let cur = path.nodes.reduce((a, b) => (b.cumulativeSec > a.cumulativeSec ? b : a));
  const chain = [cur.zoneId];
  const seen = new Set(chain);
  while (!path.roots.includes(cur.zoneId)) {
    const at = cur;
    const prev = path.segments
      .filter((s) => s.toId === at.zoneId && !seen.has(s.fromId))
      .map((s) => ({ s, from: nodeById.get(s.fromId) }))
      .find(({ s, from }) => from && Math.abs(from.cumulativeSec + s.transitionSec + at.zoneSec - at.cumulativeSec) < EPS);
    if (!prev?.from) break;
    cur = prev.from;
    chain.unshift(cur.zoneId);
    seen.add(cur.zoneId);
  }
  return chain;
}
