import {
  Coins, ScrollText, Skull, Star, Gem, Flame,
} from 'lucide-react';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, STATUS_INFO, STATUS_LOCKED,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { GraphNode, HeatmapConfig, BudgetBar } from '@/types/unique-tab-improvements';

/* ── Canonical Zone Names ──────────────────────────────────────────────────── */

export const ZONE_NAMES = {
  SANCTUARY: 'Sanctuary',
  WHISPER_WOODS: 'Whisper Woods',
  CRYSTAL_CAVES: 'Crystal Caves',
  BANDIT_CAMP: 'Bandit Camp',
  DEEP_CORE: 'Deep Core',
  RUINED_KEEP: 'Ruined Keep',
} as const;

export type ZoneName = (typeof ZONE_NAMES)[keyof typeof ZONE_NAMES];

/* ── Canonical Zone Record ─────────────────────────────────────────────────── */

export interface ZoneRecord {
  id: string;
  name: ZoneName;
  displayName: string;
  // World map canvas (percentage positions)
  cx: number;
  cy: number;
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  levelRange: string;
  levelMin: number;
  levelMax: number;
  connections: string[];
  // Topology graph rendering
  group: string;
  color: string;
  topoSize: number;
  topoX: number;
  topoY: number;
}

export const ZONES: ZoneRecord[] = [
  { id: 'z1', name: ZONE_NAMES.SANCTUARY, displayName: `${ZONE_NAMES.SANCTUARY} (Hub)`, cx: 20, cy: 50, type: 'hub', status: 'completed', levelRange: '1', levelMin: 1, levelMax: 1, connections: ['z2', 'z3'], group: 'hub', color: STATUS_SUCCESS, topoSize: 28, topoX: 80, topoY: 180 },
  { id: 'z2', name: ZONE_NAMES.WHISPER_WOODS, displayName: ZONE_NAMES.WHISPER_WOODS, cx: 45, cy: 30, type: 'combat', status: 'completed', levelRange: '1-3', levelMin: 1, levelMax: 3, connections: ['z4'], group: 'combat', color: STATUS_SUCCESS, topoSize: 22, topoX: 220, topoY: 80 },
  { id: 'z3', name: ZONE_NAMES.CRYSTAL_CAVES, displayName: ZONE_NAMES.CRYSTAL_CAVES, cx: 40, cy: 75, type: 'combat', status: 'active', levelRange: '2-4', levelMin: 2, levelMax: 4, connections: ['z5'], group: 'combat', color: STATUS_WARNING, topoSize: 22, topoX: 220, topoY: 280 },
  { id: 'z4', name: ZONE_NAMES.BANDIT_CAMP, displayName: ZONE_NAMES.BANDIT_CAMP, cx: 70, cy: 25, type: 'combat', status: 'locked', levelRange: '3-5', levelMin: 3, levelMax: 5, connections: ['z6'], group: 'combat', color: STATUS_LOCKED, topoSize: 22, topoX: 380, topoY: 60 },
  { id: 'z5', name: ZONE_NAMES.DEEP_CORE, displayName: ZONE_NAMES.DEEP_CORE, cx: 65, cy: 85, type: 'combat', status: 'locked', levelRange: '4-6', levelMin: 4, levelMax: 6, connections: ['z6'], group: 'combat', color: STATUS_LOCKED, topoSize: 22, topoX: 380, topoY: 300 },
  { id: 'z6', name: ZONE_NAMES.RUINED_KEEP, displayName: `${ZONE_NAMES.RUINED_KEEP} (Boss)`, cx: 85, cy: 50, type: 'boss', status: 'locked', levelRange: '5-7', levelMin: 5, levelMax: 7, connections: [], group: 'boss', color: STATUS_ERROR, topoSize: 30, topoX: 470, topoY: 180 },
];

/* ── Canonical Zone Edges ──────────────────────────────────────────────────── */

export interface ZoneEdge {
  fromId: string;
  toId: string;
  edgeType: 'door' | 'portal' | 'seamless';
  locked: boolean;
  criticalPath: boolean;
  transitionType: 'Loading' | 'Seamless' | 'Portal';
  estTime: string;
  navMeshContinuity: boolean;
}

export const ZONE_EDGES: ZoneEdge[] = [
  { fromId: 'z1', toId: 'z2', edgeType: 'door', locked: false, criticalPath: true, transitionType: 'Loading', estTime: '1.2s', navMeshContinuity: false },
  { fromId: 'z1', toId: 'z3', edgeType: 'seamless', locked: false, criticalPath: false, transitionType: 'Seamless', estTime: '0.0s', navMeshContinuity: true },
  { fromId: 'z2', toId: 'z4', edgeType: 'door', locked: true, criticalPath: true, transitionType: 'Loading', estTime: '1.8s', navMeshContinuity: false },
  { fromId: 'z3', toId: 'z5', edgeType: 'portal', locked: true, criticalPath: false, transitionType: 'Portal', estTime: '0.6s', navMeshContinuity: false },
  { fromId: 'z4', toId: 'z6', edgeType: 'door', locked: true, criticalPath: true, transitionType: 'Loading', estTime: '2.4s', navMeshContinuity: false },
  { fromId: 'z5', toId: 'z6', edgeType: 'portal', locked: true, criticalPath: true, transitionType: 'Portal', estTime: '0.8s', navMeshContinuity: false },
];

/* ── Derived: Topology Graph ───────────────────────────────────────────────── */

export const TOPOLOGY_NODES: GraphNode[] = ZONES.map(z => ({
  id: z.id, label: z.name, group: z.group, color: z.color,
  size: z.topoSize, x: z.topoX, y: z.topoY,
}));

export interface TopologyEdge {
  from: string;
  to: string;
  type: 'door' | 'portal' | 'seamless';
  locked: boolean;
  criticalPath: boolean;
}

export const TOPOLOGY_EDGES: TopologyEdge[] = ZONE_EDGES.map(e => ({
  from: e.fromId, to: e.toId, type: e.edgeType,
  locked: e.locked, criticalPath: e.criticalPath,
}));

export const EDGE_STYLE_MAP: Record<TopologyEdge['type'], { dash: string; label: string; color: string }> = {
  door: { dash: '0', label: 'Door', color: ACCENT_CYAN },
  portal: { dash: '4 4', label: 'Portal', color: ACCENT_VIOLET },
  seamless: { dash: '8 3', label: 'Seamless', color: ACCENT_EMERALD },
};

/** Node id -> level range string for topology tooltips */
export const TOPO_LEVEL_RANGES: Record<string, string> = Object.fromEntries(
  ZONES.map(z => [z.id, z.levelRange]),
);

/* ── Derived: Zone Connections ─────────────────────────────────────────────── */

export interface ZoneConnection {
  from: string;
  to: string;
  transitionType: 'Loading' | 'Seamless' | 'Portal';
  estTime: string;
  navMeshContinuity: boolean;
}

const zoneById = new Map(ZONES.map(z => [z.id, z]));

export const ZONE_CONNECTIONS: ZoneConnection[] = ZONE_EDGES.map(e => ({
  from: zoneById.get(e.fromId)!.name,
  to: zoneById.get(e.toId)!.name,
  transitionType: e.transitionType,
  estTime: e.estTime,
  navMeshContinuity: e.navMeshContinuity,
}));

export const TRANSITION_COLORS: Record<ZoneConnection['transitionType'], string> = {
  Loading: STATUS_WARNING,
  Seamless: ACCENT_EMERALD,
  Portal: ACCENT_VIOLET,
};

/* ── Derived: Level Range Bars ─────────────────────────────────────────────── */

export interface LevelRangeBar {
  zone: string;
  min: number;
  max: number;
  color: string;
}

export const LEVEL_RANGE_BARS: LevelRangeBar[] = ZONES.map(z => ({
  zone: z.name, min: z.levelMin, max: z.levelMax, color: z.color,
}));

export const PLAYER_LEVEL = 3;
export const MAX_LEVEL = 7;

/* ── Asset list ────────────────────────────────────────────────────────────── */

export const ASSET_FEATURES = [
  'Level Streaming setup',
  'World Partition grid',
  'HLOD generation',
  'Environment lighting (Lumen)',
  'Foliage instancing',
  'Water system (plugin)',
];

/* ── 10.2 Enemy Density Heatmap Data ──────────────────────────────────────── */

export const ENEMY_DENSITY_CONFIG: HeatmapConfig = {
  rows: ZONES.map(z => z.name),
  cols: ['NW', 'NE', 'Center', 'SW', 'SE'],
  cells: [
    // Sanctuary - almost none
    { row: 0, col: 0, value: 0.0, label: '0' }, { row: 0, col: 1, value: 0.0, label: '0' }, { row: 0, col: 2, value: 0.05, label: '1' }, { row: 0, col: 3, value: 0.0, label: '0' }, { row: 0, col: 4, value: 0.0, label: '0' },
    // Whisper Woods
    { row: 1, col: 0, value: 0.3, label: '6' }, { row: 1, col: 1, value: 0.45, label: '9' }, { row: 1, col: 2, value: 0.6, label: '12' }, { row: 1, col: 3, value: 0.2, label: '4' }, { row: 1, col: 4, value: 0.35, label: '7' },
    // Crystal Caves
    { row: 2, col: 0, value: 0.5, label: '10' }, { row: 2, col: 1, value: 0.4, label: '8' }, { row: 2, col: 2, value: 0.8, label: '16' }, { row: 2, col: 3, value: 0.65, label: '13' }, { row: 2, col: 4, value: 0.55, label: '11' },
    // Bandit Camp
    { row: 3, col: 0, value: 0.7, label: '14' }, { row: 3, col: 1, value: 0.85, label: '17' }, { row: 3, col: 2, value: 0.95, label: '19' }, { row: 3, col: 3, value: 0.6, label: '12' }, { row: 3, col: 4, value: 0.75, label: '15' },
    // Deep Core
    { row: 4, col: 0, value: 0.8, label: '16' }, { row: 4, col: 1, value: 0.9, label: '18' }, { row: 4, col: 2, value: 1.0, label: '20' }, { row: 4, col: 3, value: 0.85, label: '17' }, { row: 4, col: 4, value: 0.7, label: '14' },
    // Ruined Keep
    { row: 5, col: 0, value: 0.4, label: '8' }, { row: 5, col: 1, value: 0.35, label: '7' }, { row: 5, col: 2, value: 1.0, label: '20' }, { row: 5, col: 3, value: 0.4, label: '8' }, { row: 5, col: 4, value: 0.35, label: '7' },
  ],
};

/* ── 10.4 World Streaming Budget Data ──────────────────────────────────────── */

export const STREAMING_BUDGETS: BudgetBar[] = [
  { label: 'Memory', current: 380, max: 512, unit: 'MB', color: ACCENT_CYAN, threshold: { warn: 420, danger: 480 } },
  { label: 'LoadTime', current: 2.1, max: 3.0, unit: 's', color: ACCENT_EMERALD, threshold: { warn: 2.5, danger: 2.8 } },
  { label: 'CellCount', current: 12, max: 20, unit: '', color: ACCENT_VIOLET, threshold: { warn: 16, danger: 18 } },
  { label: 'TexturePool', current: 45, max: 64, unit: 'MB', color: ACCENT_ORANGE, threshold: { warn: 52, danger: 60 } },
];

/* ── 10.5 Points of Interest Data ──────────────────────────────────────────── */

export type PoiType = 'vendor' | 'quest' | 'boss' | 'shrine' | 'treasure' | 'bonfire';

export interface PointOfInterest {
  type: PoiType;
  count: number;
}

export interface ZonePoi {
  zone: string;
  pois: PointOfInterest[];
  discoveryPct: number;
}

export const POI_ICONS: Record<PoiType, { icon: typeof Coins; label: string; color: string }> = {
  vendor: { icon: Coins, label: 'Vendor', color: STATUS_WARNING },
  quest: { icon: ScrollText, label: 'Quest', color: STATUS_INFO },
  boss: { icon: Skull, label: 'Boss', color: STATUS_ERROR },
  shrine: { icon: Star, label: 'Shrine', color: ACCENT_VIOLET },
  treasure: { icon: Gem, label: 'Treasure', color: ACCENT_EMERALD },
  bonfire: { icon: Flame, label: 'Bonfire', color: ACCENT_ORANGE },
};

export const ZONE_POIS: ZonePoi[] = [
  { zone: ZONE_NAMES.SANCTUARY, pois: [{ type: 'vendor', count: 3 }, { type: 'bonfire', count: 1 }, { type: 'quest', count: 2 }], discoveryPct: 100 },
  { zone: ZONE_NAMES.WHISPER_WOODS, pois: [{ type: 'quest', count: 4 }, { type: 'treasure', count: 2 }, { type: 'shrine', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 85 },
  { zone: ZONE_NAMES.CRYSTAL_CAVES, pois: [{ type: 'quest', count: 3 }, { type: 'treasure', count: 3 }, { type: 'boss', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 40 },
  { zone: ZONE_NAMES.BANDIT_CAMP, pois: [{ type: 'quest', count: 5 }, { type: 'vendor', count: 1 }, { type: 'treasure', count: 2 }, { type: 'boss', count: 1 }], discoveryPct: 0 },
  { zone: ZONE_NAMES.DEEP_CORE, pois: [{ type: 'shrine', count: 2 }, { type: 'treasure', count: 4 }, { type: 'boss', count: 1 }, { type: 'bonfire', count: 1 }], discoveryPct: 0 },
  { zone: ZONE_NAMES.RUINED_KEEP, pois: [{ type: 'boss', count: 1 }, { type: 'treasure', count: 1 }, { type: 'shrine', count: 1 }], discoveryPct: 0 },
];

/* ── 10.7 Boss Arena Details Data ──────────────────────────────────────────── */

export interface BossArena {
  bossName: string;
  zone: string;
  phases: number;
  arenaSize: string;
  hazards: string[];
  recommendedLevel: number;
  musicTheme: string;
}

export const BOSS_ARENAS: BossArena[] = [
  {
    bossName: 'Crystal Golem',
    zone: ZONE_NAMES.CRYSTAL_CAVES,
    phases: 2,
    arenaSize: '40x40m',
    hazards: ['Crystal Shards', 'Cave-in'],
    recommendedLevel: 4,
    musicTheme: 'Echoes of Stone',
  },
  {
    bossName: 'Bandit Warlord',
    zone: ZONE_NAMES.BANDIT_CAMP,
    phases: 3,
    arenaSize: '50x30m',
    hazards: ['Fire Barrels', 'Spike Traps'],
    recommendedLevel: 5,
    musicTheme: 'Clash of Blades',
  },
  {
    bossName: 'Abyssal Crawler',
    zone: ZONE_NAMES.DEEP_CORE,
    phases: 2,
    arenaSize: '35x35m',
    hazards: ['Lava Vents', 'Falling Rocks'],
    recommendedLevel: 6,
    musicTheme: 'Descent Into Dark',
  },
  {
    bossName: 'The Hollow King',
    zone: ZONE_NAMES.RUINED_KEEP,
    phases: 4,
    arenaSize: '60x60m',
    hazards: ['Cursed Ground', 'Spirit Pillars', 'Collapse'],
    recommendedLevel: 7,
    musicTheme: 'Requiem of Ruin',
  },
];

/* ── 10.8 Environmental Hazard Map Data ────────────────────────────────────── */

export interface EnvHazard {
  zone: string;
  type: 'Lava' | 'Poison' | 'Trap' | 'Falling';
  damagePerSec: number;
  affectedArea: string;
  warningLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export const ENV_HAZARDS: EnvHazard[] = [
  { zone: ZONE_NAMES.CRYSTAL_CAVES, type: 'Falling', damagePerSec: 15, affectedArea: '12%', warningLevel: 'Medium' },
  { zone: ZONE_NAMES.CRYSTAL_CAVES, type: 'Trap', damagePerSec: 25, affectedArea: '5%', warningLevel: 'High' },
  { zone: ZONE_NAMES.BANDIT_CAMP, type: 'Trap', damagePerSec: 30, affectedArea: '8%', warningLevel: 'High' },
  { zone: ZONE_NAMES.DEEP_CORE, type: 'Lava', damagePerSec: 40, affectedArea: '20%', warningLevel: 'Critical' },
  { zone: ZONE_NAMES.DEEP_CORE, type: 'Poison', damagePerSec: 10, affectedArea: '15%', warningLevel: 'Medium' },
  { zone: ZONE_NAMES.RUINED_KEEP, type: 'Trap', damagePerSec: 35, affectedArea: '10%', warningLevel: 'High' },
  { zone: ZONE_NAMES.RUINED_KEEP, type: 'Falling', damagePerSec: 50, affectedArea: '18%', warningLevel: 'Critical' },
];

export const HAZARD_TYPE_COLORS: Record<EnvHazard['type'], string> = {
  Lava: STATUS_ERROR,
  Poison: ACCENT_EMERALD,
  Trap: STATUS_WARNING,
  Falling: ACCENT_VIOLET,
};

export const HAZARD_WARNING_COLORS: Record<EnvHazard['warningLevel'], string> = {
  Low: STATUS_SUCCESS,
  Medium: STATUS_WARNING,
  High: ACCENT_ORANGE,
  Critical: STATUS_ERROR,
};

// Derived: Danger score per zone from ENV_HAZARDS — sum(dps * area fraction)
export const ZONE_DANGER_SCORES: { zone: string; score: number }[] = (() => {
  const scores = new Map<string, number>();
  for (const z of ZONES) scores.set(z.name, 0);
  for (const h of ENV_HAZARDS) {
    scores.set(h.zone, (scores.get(h.zone) ?? 0) + h.damagePerSec * parseFloat(h.affectedArea) / 100);
  }
  return Array.from(scores, ([zone, score]) => ({ zone, score: Math.round(score * 100) / 100 }));
})();

/* ── 10.9 Fast Travel Network Data ─────────────────────────────────────────── */

export interface FastTravelNode {
  name: string;
  zone: string;
  discovered: boolean;
  travelTimes: { to: string; seconds: number }[];
}

export const FAST_TRAVEL_NODES: FastTravelNode[] = [
  { name: 'Sanctuary Waypoint', zone: ZONE_NAMES.SANCTUARY, discovered: true, travelTimes: [{ to: 'Woods Gate', seconds: 8 }, { to: 'Cave Entrance', seconds: 12 }] },
  { name: 'Woods Gate', zone: ZONE_NAMES.WHISPER_WOODS, discovered: true, travelTimes: [{ to: 'Sanctuary Waypoint', seconds: 8 }, { to: 'Camp Outskirts', seconds: 15 }] },
  { name: 'Cave Entrance', zone: ZONE_NAMES.CRYSTAL_CAVES, discovered: true, travelTimes: [{ to: 'Sanctuary Waypoint', seconds: 12 }, { to: 'Core Rift', seconds: 18 }] },
  { name: 'Camp Outskirts', zone: ZONE_NAMES.BANDIT_CAMP, discovered: false, travelTimes: [{ to: 'Woods Gate', seconds: 15 }, { to: 'Keep Gates', seconds: 20 }] },
  { name: 'Core Rift', zone: ZONE_NAMES.DEEP_CORE, discovered: false, travelTimes: [{ to: 'Cave Entrance', seconds: 18 }, { to: 'Keep Gates', seconds: 22 }] },
  { name: 'Keep Gates', zone: ZONE_NAMES.RUINED_KEEP, discovered: false, travelTimes: [{ to: 'Camp Outskirts', seconds: 20 }, { to: 'Core Rift', seconds: 22 }] },
];

// Derived: Fast travel coverage per zone from FAST_TRAVEL_NODES
export const FAST_TRAVEL_COVERAGE: { zone: string; pct: number }[] = ZONES.map(z => {
  const node = FAST_TRAVEL_NODES.find(n => n.zone === z.name);
  return { zone: z.name, pct: node?.discovered ? 100 : 0 };
});

/* ── 10.10 Zone Progression Timeline Data ──────────────────────────────────── */

export interface ZoneProgressionBar {
  zone: string;
  firstVisitDay: number;
  completionDay: number | null; // null = not yet completed
  completionPct: number;
  color: string;
}

export const ZONE_PROGRESSION: ZoneProgressionBar[] = [
  { zone: ZONE_NAMES.SANCTUARY, firstVisitDay: 0, completionDay: 1, completionPct: 100, color: STATUS_SUCCESS },
  { zone: ZONE_NAMES.WHISPER_WOODS, firstVisitDay: 1, completionDay: 4, completionPct: 100, color: STATUS_SUCCESS },
  { zone: ZONE_NAMES.CRYSTAL_CAVES, firstVisitDay: 3, completionDay: null, completionPct: 40, color: STATUS_WARNING },
  { zone: ZONE_NAMES.BANDIT_CAMP, firstVisitDay: -1, completionDay: null, completionPct: 0, color: STATUS_LOCKED },
  { zone: ZONE_NAMES.DEEP_CORE, firstVisitDay: -1, completionDay: null, completionPct: 0, color: STATUS_LOCKED },
  { zone: ZONE_NAMES.RUINED_KEEP, firstVisitDay: -1, completionDay: null, completionPct: 0, color: STATUS_LOCKED },
];

export const TOTAL_ESTIMATED_DAYS = 14;
export const CURRENT_DAY = 5;

/* ── 10.11 Critical Path Playtime Estimator Data ──────────────────────────── */

/** Seconds per enemy kill estimate (varies by zone difficulty via level) */
const SECONDS_PER_ENEMY = 8;
/** Seconds per boss phase (includes mechanics, dodging, healing) */
const SECONDS_PER_BOSS_PHASE = 90;
/** Base exploration time per zone in seconds (traversal, NPC, loot pickup) */
const BASE_EXPLORATION_SEC: Record<ZoneRecord['type'], number> = {
  hub: 120,     // 2 min — minimal combat, mostly NPC interaction
  combat: 300,  // 5 min — traversal + side encounters
  boss: 180,    // 3 min — linear run to boss arena
};

export interface ZonePlaytimeEstimate {
  zoneId: string;
  zoneName: string;
  /** Total enemies across all sectors */
  enemyCount: number;
  /** Estimated combat time in seconds */
  combatSec: number;
  /** Boss fight time in seconds (0 if no boss) */
  bossSec: number;
  /** Exploration / traversal time in seconds */
  explorationSec: number;
  /** Total zone time in seconds */
  totalSec: number;
}

/** Per-zone playtime breakdown derived from enemy density + boss phases + zone type */
export const ZONE_PLAYTIME: ZonePlaytimeEstimate[] = ZONES.map(z => {
  // Sum enemy count from heatmap
  const zoneIdx = ENEMY_DENSITY_CONFIG.rows.indexOf(z.name);
  const enemyCount = ENEMY_DENSITY_CONFIG.cells
    .filter(c => c.row === zoneIdx)
    .reduce((sum, c) => sum + parseInt(c.label ?? '0'), 0);

  const combatSec = enemyCount * SECONDS_PER_ENEMY;

  // Boss phases
  const boss = BOSS_ARENAS.find(b => b.zone === z.name);
  const bossSec = boss ? boss.phases * SECONDS_PER_BOSS_PHASE : 0;

  const explorationSec = BASE_EXPLORATION_SEC[z.type];
  const totalSec = combatSec + bossSec + explorationSec;

  return { zoneId: z.id, zoneName: z.name, enemyCount, combatSec, bossSec, explorationSec, totalSec };
});

const playtimeByZoneId = new Map(ZONE_PLAYTIME.map(p => [p.zoneId, p]));

/** Parse "1.2s" -> 1.2 */
function parseEstTime(s: string): number {
  return parseFloat(s.replace('s', '')) || 0;
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
  /** Cumulative seconds when arriving at this node (including prior zones + transitions) */
  cumulativeSec: number;
  /** This zone's own playtime */
  zoneSec: number;
}

/**
 * BFS / topological walk from the start node (z1 = Sanctuary) to compute
 * cumulative playtime along the critical path or all reachable paths.
 */
function computeCumulativePath(mode: PlaytimePathMode): { nodes: CumulativeNode[]; segments: PathSegment[]; totalSec: number } {
  const edges = ZONE_EDGES.filter(e => mode === 'critical' ? e.criticalPath : true);
  const segments: PathSegment[] = edges.map(e => ({
    fromId: e.fromId, toId: e.toId,
    transitionSec: parseEstTime(e.estTime),
    criticalPath: e.criticalPath,
  }));

  // Build adjacency list (directed graph)
  const adj = new Map<string, { toId: string; transitionSec: number }[]>();
  for (const s of segments) {
    if (!adj.has(s.fromId)) adj.set(s.fromId, []);
    adj.get(s.fromId)!.push({ toId: s.toId, transitionSec: s.transitionSec });
  }

  // Longest-path walk (DAG) — use topological BFS with max cumulative
  const cumulative = new Map<string, number>();
  const startId = 'z1';
  const startPlaytime = playtimeByZoneId.get(startId)?.totalSec ?? 0;
  cumulative.set(startId, startPlaytime);

  // BFS in topological order (simple since our zone graph is a DAG)
  const queue = [startId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const currentCum = cumulative.get(current) ?? 0;
    for (const { toId, transitionSec } of adj.get(current) ?? []) {
      const zoneTime = playtimeByZoneId.get(toId)?.totalSec ?? 0;
      const arrival = currentCum + transitionSec + zoneTime;
      if (arrival > (cumulative.get(toId) ?? 0)) {
        cumulative.set(toId, arrival);
      }
      queue.push(toId);
    }
  }

  // Build nodes array ordered by cumulative time
  const nodes: CumulativeNode[] = Array.from(cumulative.entries())
    .map(([zoneId, cumulativeSec]) => ({
      zoneId,
      zoneName: zoneById.get(zoneId)?.name ?? zoneId,
      cumulativeSec,
      zoneSec: playtimeByZoneId.get(zoneId)?.totalSec ?? 0,
    }))
    .sort((a, b) => a.cumulativeSec - b.cumulativeSec);

  const totalSec = Math.max(...Array.from(cumulative.values()), 0);
  return { nodes, segments, totalSec };
}

/** Pre-computed paths for both modes */
export const CRITICAL_PATH = computeCumulativePath('critical');
export const ALL_PATHS = computeCumulativePath('all');

/** Format seconds to "Xm Ys" or "Xh Ym" */
export function formatPlaytime(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
