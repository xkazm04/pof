/**
 * World analytics model — pure, IO-free playtime math over ANY zone graph.
 *
 * A `WorldModel` is the zone graph plus the authored inputs that price it
 * (enemies and boss phases per zone id). The static world in
 * `sub_world/_shared/data.ts` (`STATIC_WORLD`), a procedural candidate from
 * `generateZoneGraph` (via `worldFromZones`) and, later, catalog zone-map
 * entries are all priced by the same two functions:
 *
 *   computeZonePlaytime(world, costs?)          → per-zone estimate
 *   computeCumulativePath(world, mode, costs?)  → arrival time along the path
 *
 * Inputs are keyed by zone id (never by row index), a zone with no enemy data
 * reports `enemyCount: null` / `combatMeasured: false` instead of 0, and the
 * path walk starts at every hub and skips back edges, so cyclic graphs
 * (bidirectional connections) terminate.
 */

export type WorldZoneType = 'hub' | 'combat' | 'boss';

export interface WorldZone {
  id: string;
  name: string;
  type: WorldZoneType;
  levelMin: number;
  levelMax: number;
}

export interface WorldEdge {
  fromId: string;
  toId: string;
  /** Loading / transition time in seconds. */
  transitionSec: number;
  criticalPath: boolean;
}

export interface WorldModel {
  zones: readonly WorldZone[];
  edges: readonly WorldEdge[];
  /** Authored enemy count per zone id. A missing key = combat not measured. */
  enemiesByZoneId: Readonly<Record<string, number>>;
  /** Boss phases per zone id. A missing key = no boss. */
  bossPhasesByZoneId: Readonly<Record<string, number>>;
  /** Optional per-zone exploration override (seconds); defaults to the cost table's by-type value. */
  explorationSecByZoneId?: Readonly<Record<string, number>>;
}

export interface PlaytimeCosts {
  /** Seconds per enemy kill. */
  secPerEnemy: number;
  /** Seconds per boss phase (mechanics, dodging, healing). */
  secPerBossPhase: number;
  /** Base exploration per zone type (traversal, NPCs, loot pickup). */
  explorationSecByType: Readonly<Record<WorldZoneType, number>>;
}

/** THE cost table — the single source for every playtime figure in the world module. */
export const DEFAULT_PLAYTIME_COSTS: PlaytimeCosts = {
  secPerEnemy: 8,
  secPerBossPhase: 90,
  explorationSecByType: {
    hub: 120,    // 2 min — minimal combat, mostly NPC interaction
    combat: 300, // 5 min — traversal + side encounters
    boss: 180,   // 3 min — linear run to the boss arena
  },
};

export function resolveCosts(costs?: Partial<PlaytimeCosts>): PlaytimeCosts {
  return { ...DEFAULT_PLAYTIME_COSTS, ...costs };
}

export interface ZonePlaytimeEstimate {
  zoneId: string;
  zoneName: string;
  /** Total enemies across all sectors; null when the zone has no enemy data. */
  enemyCount: number | null;
  /** False when combat time is unknown (no enemy data), as opposed to deliberately 0. */
  combatMeasured: boolean;
  combatSec: number;
  /** Boss fight time (0 if no boss). */
  bossSec: number;
  explorationSec: number;
  totalSec: number;
}

/** Per-zone playtime, in `world.zones` order. */
export function computeZonePlaytime(world: WorldModel, costs?: Partial<PlaytimeCosts>): ZonePlaytimeEstimate[] {
  const c = resolveCosts(costs);
  return world.zones.map((z) => {
    const enemies = world.enemiesByZoneId[z.id];
    const combatMeasured = enemies !== undefined;
    const enemyCount = combatMeasured ? enemies : null;
    const combatSec = (enemyCount ?? 0) * c.secPerEnemy;
    const bossSec = (world.bossPhasesByZoneId[z.id] ?? 0) * c.secPerBossPhase;
    const explorationSec = world.explorationSecByZoneId?.[z.id] ?? c.explorationSecByType[z.type];
    const totalSec = combatSec + bossSec + explorationSec;
    return { zoneId: z.id, zoneName: z.name, enemyCount, combatMeasured, combatSec, bossSec, explorationSec, totalSec };
  });
}

export type PlaytimePathMode = 'critical' | 'all';

export interface PathSegment {
  fromId: string;
  toId: string;
  transitionSec: number;
  criticalPath: boolean;
}

export interface CumulativeNode {
  zoneId: string;
  zoneName: string;
  /** Seconds when this zone is finished (prior zones + transitions + this zone). */
  cumulativeSec: number;
  /** This zone's own playtime. */
  zoneSec: number;
}

export interface CumulativePath {
  /** Zones the walk started from: every hub (fallback: zones with no incoming edge, else the first zone). */
  roots: string[];
  /** Reachable zones, ordered by cumulative time. */
  nodes: CumulativeNode[];
  /** Every edge of the mode between known zones. */
  segments: PathSegment[];
  /** Longest arrival over all nodes (0 for an empty world). */
  totalSec: number;
}

function pickRoots(world: WorldModel, segments: PathSegment[]): string[] {
  const hubs = world.zones.filter((z) => z.type === 'hub').map((z) => z.id);
  if (hubs.length > 0) return hubs;
  const hasIncoming = new Set(segments.map((s) => s.toId));
  const sources = world.zones.filter((z) => !hasIncoming.has(z.id)).map((z) => z.id);
  if (sources.length > 0) return sources;
  return world.zones.length > 0 ? [world.zones[0].id] : [];
}

/**
 * Longest-arrival walk from every root. A DFS classifies edges into the zone
 * currently on the stack as back edges and drops them; the remainder is a DAG,
 * relaxed in reverse post-order, so every zone is priced exactly once.
 */
export function computeCumulativePath(
  world: WorldModel, mode: PlaytimePathMode, costs?: Partial<PlaytimeCosts>,
): CumulativePath {
  const zoneById = new Map(world.zones.map((z) => [z.id, z]));
  const zoneSec = new Map(computeZonePlaytime(world, costs).map((p) => [p.zoneId, p.totalSec]));
  const segments: PathSegment[] = world.edges
    .filter((e) => (mode === 'critical' ? e.criticalPath : true) && zoneById.has(e.fromId) && zoneById.has(e.toId))
    .map((e) => ({ fromId: e.fromId, toId: e.toId, transitionSec: e.transitionSec, criticalPath: e.criticalPath }));

  const adj = new Map<string, PathSegment[]>();
  for (const s of segments) adj.set(s.fromId, [...(adj.get(s.fromId) ?? []), s]);

  const roots = pickRoots(world, segments);
  const state = new Map<string, 'open' | 'done'>();
  const postOrder: string[] = [];
  const forward = new Map<string, PathSegment[]>();
  for (const root of roots) {
    if (state.has(root)) continue;
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }];
    state.set(root, 'open');
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const out = adj.get(top.id) ?? [];
      if (top.next >= out.length) {
        state.set(top.id, 'done');
        postOrder.push(top.id);
        stack.pop();
        continue;
      }
      const seg = out[top.next++];
      const seen = state.get(seg.toId);
      if (seen === 'open') continue; // back edge — the cycle is not re-walked
      forward.set(top.id, [...(forward.get(top.id) ?? []), seg]);
      if (seen === undefined) {
        state.set(seg.toId, 'open');
        stack.push({ id: seg.toId, next: 0 });
      }
    }
  }

  const topo = postOrder.reverse();
  const cumulative = new Map<string, number>();
  for (const r of roots) cumulative.set(r, zoneSec.get(r) ?? 0);
  for (const id of topo) {
    const cur = cumulative.get(id);
    if (cur === undefined) continue;
    for (const s of forward.get(id) ?? []) {
      const arrival = cur + s.transitionSec + (zoneSec.get(s.toId) ?? 0);
      if (arrival > (cumulative.get(s.toId) ?? -Infinity)) cumulative.set(s.toId, arrival);
    }
  }

  const nodes: CumulativeNode[] = topo
    .filter((id) => cumulative.has(id))
    .map((id) => ({
      zoneId: id,
      zoneName: zoneById.get(id)?.name ?? id,
      cumulativeSec: cumulative.get(id)!,
      zoneSec: zoneSec.get(id) ?? 0,
    }))
    .sort((a, b) => a.cumulativeSec - b.cumulativeSec);

  const totalSec = nodes.reduce((m, n) => Math.max(m, n.cumulativeSec), 0);
  return { roots, nodes, segments, totalSec };
}

/** Anything zone-shaped with outgoing `connections` (GeneratedZone, sub_world ZoneRecord, catalog zones). */
export interface ConnectedZoneLike {
  id: string;
  name?: string;
  displayName?: string;
  type: WorldZoneType;
  connections: readonly string[];
  levelMin?: number;
  levelMax?: number;
}

/**
 * Adapter: a zone list whose topology lives in `connections`. Every edge is
 * critical with a 0 s transition, and no enemy/boss data is known — so combat
 * reports as not measured and the estimate is exploration-only.
 */
export function worldFromZones(zones: readonly ConnectedZoneLike[]): WorldModel {
  const ids = new Set(zones.map((z) => z.id));
  return {
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name ?? z.displayName ?? z.id,
      type: z.type,
      levelMin: z.levelMin ?? 1,
      levelMax: z.levelMax ?? z.levelMin ?? 1,
    })),
    edges: zones.flatMap((z) => z.connections
      .filter((to) => ids.has(to))
      .map((toId) => ({ fromId: z.id, toId, transitionSec: 0, criticalPath: true }))),
    enemiesByZoneId: {},
    bossPhasesByZoneId: {},
  };
}

/** Format seconds to "Xs", "Xm Ys" or "Xh Ym". */
export function formatPlaytime(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
