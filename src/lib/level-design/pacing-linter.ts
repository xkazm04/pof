import type {
  LevelDesignDocument,
  RoomNode,
  RoomConnection,
  RoomType,
} from '@/types/level-design';

export type PacingSeverity = 'info' | 'warning' | 'critical';

export type PacingRuleId =
  | 'consecutive-combat'
  | 'difficulty-cliff'
  | 'monotonic-ramp'
  | 'no-safe-before-boss'
  | 'unreachable-room';

export interface PacingFinding {
  id: string;
  ruleId: PacingRuleId;
  severity: PacingSeverity;
  /** Rooms this finding refers to. First entry is the primary anchor for inline badges. */
  roomIds: string[];
  /** Human-readable title (short). */
  title: string;
  /** Detailed description of what was detected. */
  message: string;
  /** Actionable suggestion (e.g. "insert a rest room after Room 4"). */
  suggestion: string;
}

export interface PacingLintResult {
  findings: PacingFinding[];
  /** Findings grouped by primary room id for inline badges. */
  byRoom: Record<string, PacingFinding[]>;
  /** Severity counts for summary chips. */
  counts: Record<PacingSeverity, number>;
}

const COMBAT_TYPES: ReadonlySet<RoomType> = new Set<RoomType>(['combat', 'boss']);
const RESTFUL_TYPES: ReadonlySet<RoomType> = new Set<RoomType>([
  'safe',
  'cutscene',
  'puzzle',
  'exploration',
  'hub',
  'transition',
]);

function makeId(prefix: PacingRuleId, suffix: string): string {
  return `${prefix}:${suffix}`;
}

function roomLabel(room: RoomNode | undefined, fallback: string): string {
  return room?.name?.trim() || fallback;
}

/**
 * Determine the intended traversal order.
 * Prefers the explicit `difficultyArc`; otherwise falls back to a best-effort
 * traversal from rooms with no incoming connections (topological-ish BFS).
 */
function resolveArc(doc: LevelDesignDocument): RoomNode[] {
  const byId = new Map(doc.rooms.map((r) => [r.id, r] as const));

  if (doc.difficultyArc.length > 0) {
    return doc.difficultyArc
      .map((id) => byId.get(id))
      .filter((r): r is RoomNode => Boolean(r));
  }

  // Fallback: pick rooms with no incoming directed edge as start points.
  const incoming = new Map<string, number>();
  for (const r of doc.rooms) incoming.set(r.id, 0);
  for (const c of doc.connections) {
    if (byId.has(c.toId)) incoming.set(c.toId, (incoming.get(c.toId) ?? 0) + 1);
    if (c.bidirectional && byId.has(c.fromId)) {
      incoming.set(c.fromId, (incoming.get(c.fromId) ?? 0) + 1);
    }
  }
  const starts = doc.rooms.filter((r) => (incoming.get(r.id) ?? 0) === 0);
  const seedList = starts.length > 0 ? starts : doc.rooms.slice(0, 1);

  const order: RoomNode[] = [];
  const seen = new Set<string>();
  const queue: string[] = seedList.map((r) => r.id);
  const adj = buildAdjacency(doc.rooms, doc.connections);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const r = byId.get(id);
    if (r) order.push(r);
    for (const next of adj.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  // Append any remaining rooms not reachable so the arc still covers them.
  for (const r of doc.rooms) {
    if (!seen.has(r.id)) order.push(r);
  }
  return order;
}

function buildAdjacency(
  rooms: RoomNode[],
  connections: RoomConnection[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of rooms) adj.set(r.id, []);
  for (const c of connections) {
    adj.get(c.fromId)?.push(c.toId);
    if (c.bidirectional) adj.get(c.toId)?.push(c.fromId);
  }
  return adj;
}

function neighborsOf(
  roomId: string,
  rooms: RoomNode[],
  connections: RoomConnection[],
): RoomNode[] {
  const byId = new Map(rooms.map((r) => [r.id, r] as const));
  const ids = new Set<string>();
  for (const c of connections) {
    if (c.fromId === roomId) ids.add(c.toId);
    if (c.toId === roomId && c.bidirectional) ids.add(c.fromId);
    // For directed connections, also consider rooms that lead INTO the boss —
    // a safe room placed before the boss is just as valid as one after.
    if (c.toId === roomId) ids.add(c.fromId);
  }
  return Array.from(ids)
    .map((id) => byId.get(id))
    .filter((r): r is RoomNode => Boolean(r));
}

// ── Rule: 3+ consecutive combat rooms with no rest ──

function lintConsecutiveCombat(arc: RoomNode[]): PacingFinding[] {
  const findings: PacingFinding[] = [];
  let run: RoomNode[] = [];

  const flush = () => {
    if (run.length >= 3) {
      const anchor = run[run.length - 1];
      const after = run[1] ?? run[0];
      findings.push({
        id: makeId('consecutive-combat', anchor.id),
        ruleId: 'consecutive-combat',
        severity: 'warning',
        roomIds: run.map((r) => r.id),
        title: `${run.length} consecutive combat rooms`,
        message: `Rooms ${run.map((r) => roomLabel(r, r.id)).join(' → ')} are all combat encounters with no rest in between. Players need recovery beats.`,
        suggestion: `Insert a rest, puzzle, or exploration room after ${roomLabel(after, 'the second combat room')} to reset tension.`,
      });
    }
    run = [];
  };

  for (const room of arc) {
    if (COMBAT_TYPES.has(room.type) && room.pacing !== 'rest') {
      run.push(room);
    } else if (RESTFUL_TYPES.has(room.type) || room.pacing === 'rest') {
      flush();
    } else {
      run.push(room); // unknown room type — count as continuing the run
    }
  }
  flush();
  return findings;
}

// ── Rule: difficulty cliff (sudden jump of >= 3 between adjacent rooms) ──

function lintDifficultyCliff(arc: RoomNode[]): PacingFinding[] {
  const findings: PacingFinding[] = [];
  for (let i = 1; i < arc.length; i++) {
    const prev = arc[i - 1];
    const curr = arc[i];
    const delta = curr.difficulty - prev.difficulty;
    if (delta >= 3) {
      findings.push({
        id: makeId('difficulty-cliff', curr.id),
        ruleId: 'difficulty-cliff',
        severity: 'critical',
        roomIds: [curr.id, prev.id],
        title: `Difficulty cliff (+${delta})`,
        message: `${roomLabel(curr, curr.id)} jumps to difficulty ${curr.difficulty} from ${prev.difficulty} in ${roomLabel(prev, prev.id)}. Sudden spikes feel unfair.`,
        suggestion: `Add an intermediate room between ${roomLabel(prev, 'the previous room')} and ${roomLabel(curr, 'this room')} at difficulty ${prev.difficulty + 1}, or lower this room to ${prev.difficulty + 1}.`,
      });
    } else if (delta <= -3) {
      findings.push({
        id: makeId('difficulty-cliff', `${curr.id}-drop`),
        ruleId: 'difficulty-cliff',
        severity: 'warning',
        roomIds: [curr.id, prev.id],
        title: `Difficulty drop (${delta})`,
        message: `${roomLabel(curr, curr.id)} drops to difficulty ${curr.difficulty} from ${prev.difficulty}. Players may feel under-stimulated.`,
        suggestion: `Either keep ${roomLabel(curr, 'this room')} closer to ${prev.difficulty - 1}, or frame the drop deliberately (treasure/rest beat).`,
      });
    }
  }
  return findings;
}

// ── Rule: monotonic ramp (no variation across the whole arc) ──

function lintMonotonicRamp(arc: RoomNode[]): PacingFinding[] {
  if (arc.length < 4) return [];
  let allNonDecreasing = true;
  let allNonIncreasing = true;
  let totalChange = 0;
  for (let i = 1; i < arc.length; i++) {
    const d = arc[i].difficulty - arc[i - 1].difficulty;
    totalChange += d;
    if (d < 0) allNonDecreasing = false;
    if (d > 0) allNonIncreasing = false;
  }
  if (!allNonDecreasing && !allNonIncreasing) return [];
  if (Math.abs(totalChange) < 3) return [];

  const ramp = allNonDecreasing ? 'upward' : 'downward';
  const anchor = arc[Math.floor(arc.length / 2)];
  return [
    {
      id: makeId('monotonic-ramp', anchor.id),
      ruleId: 'monotonic-ramp',
      severity: 'info',
      roomIds: arc.map((r) => r.id),
      title: `Monotonic ${ramp} ramp`,
      message: `Difficulty only moves ${ramp} across all ${arc.length} rooms. Great arcs zig-zag — players relax before each new peak.`,
      suggestion: `Introduce a dip of 1–2 difficulty around ${roomLabel(anchor, 'the mid-section')} so the climb reads as deliberate, not relentless.`,
    },
  ];
}

// ── Rule: no safe/rest zone adjacent to a boss room ──

function lintNoSafeBeforeBoss(doc: LevelDesignDocument): PacingFinding[] {
  const findings: PacingFinding[] = [];
  for (const room of doc.rooms) {
    if (room.type !== 'boss') continue;
    const neighbors = neighborsOf(room.id, doc.rooms, doc.connections);
    const hasSafeNearby = neighbors.some(
      (n) => n.type === 'safe' || n.pacing === 'rest',
    );
    if (!hasSafeNearby) {
      findings.push({
        id: makeId('no-safe-before-boss', room.id),
        ruleId: 'no-safe-before-boss',
        severity: 'critical',
        roomIds: [room.id],
        title: 'Boss with no safe approach',
        message: `${roomLabel(room, room.id)} (boss) has no adjacent safe zone or rest-paced room. Players can't heal, resupply, or commit to the fight.`,
        suggestion: `Add a safe-zone or rest-paced room connected to ${roomLabel(room, 'this boss')} so players can prep before the encounter.`,
      });
    }
  }
  return findings;
}

// ── Rule: unreachable rooms ──

function lintUnreachable(doc: LevelDesignDocument): PacingFinding[] {
  if (doc.rooms.length === 0) return [];

  // Pick a start: first arc entry, else lowest-id no-incoming room, else first room.
  const byId = new Map(doc.rooms.map((r) => [r.id, r] as const));
  const incoming = new Map<string, number>();
  for (const r of doc.rooms) incoming.set(r.id, 0);
  for (const c of doc.connections) {
    if (byId.has(c.toId)) incoming.set(c.toId, (incoming.get(c.toId) ?? 0) + 1);
    if (c.bidirectional && byId.has(c.fromId)) {
      incoming.set(c.fromId, (incoming.get(c.fromId) ?? 0) + 1);
    }
  }

  const arcStart = doc.difficultyArc.find((id) => byId.has(id));
  const noIncomingStarts = doc.rooms.filter((r) => (incoming.get(r.id) ?? 0) === 0).map((r) => r.id);
  const seeds = arcStart
    ? [arcStart, ...noIncomingStarts.filter((id) => id !== arcStart)]
    : noIncomingStarts.length > 0
      ? noIncomingStarts
      : [doc.rooms[0].id];

  const adj = buildAdjacency(doc.rooms, doc.connections);
  const seen = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of adj.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  const findings: PacingFinding[] = [];
  for (const room of doc.rooms) {
    if (!seen.has(room.id)) {
      findings.push({
        id: makeId('unreachable-room', room.id),
        ruleId: 'unreachable-room',
        severity: 'critical',
        roomIds: [room.id],
        title: 'Unreachable room',
        message: `${roomLabel(room, room.id)} has no path from the level's start. Players will never see it.`,
        suggestion: `Connect ${roomLabel(room, 'this room')} to an existing room, or remove it if it's no longer needed.`,
      });
    }
  }
  return findings;
}

// ── Public entry point ──

export function lintLevelPacing(doc: LevelDesignDocument): PacingLintResult {
  const arc = resolveArc(doc);

  const findings: PacingFinding[] = [
    ...lintConsecutiveCombat(arc),
    ...lintDifficultyCliff(arc),
    ...lintMonotonicRamp(arc),
    ...lintNoSafeBeforeBoss(doc),
    ...lintUnreachable(doc),
  ];

  const byRoom: Record<string, PacingFinding[]> = {};
  for (const f of findings) {
    const anchor = f.roomIds[0];
    if (!anchor) continue;
    (byRoom[anchor] ??= []).push(f);
  }

  const counts: Record<PacingSeverity, number> = { info: 0, warning: 0, critical: 0 };
  for (const f of findings) counts[f.severity]++;

  return { findings, byRoom, counts };
}

export const RULE_LABELS: Record<PacingRuleId, string> = {
  'consecutive-combat': 'Consecutive Combat',
  'difficulty-cliff': 'Difficulty Cliff',
  'monotonic-ramp': 'Monotonic Ramp',
  'no-safe-before-boss': 'No Safe Before Boss',
  'unreachable-room': 'Unreachable Room',
};
