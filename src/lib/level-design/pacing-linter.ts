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
  | 'unreachable-room'
  | 'gated-unreachable'
  | 'unwinnable-gate'
  | 'gate-deadlock'
  | 'undeclared-gate';

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

/** One iteration of the gate-and-key closure — see {@link ReachabilityLedger}. */
export interface GateClosureLevel {
  /** 0 is the free reachable set (no keys held). */
  level: number;
  /** Rooms reachable once the keys of every earlier level are held. */
  roomsReached: number;
  /** Distinct key/flag identifiers held at this level. */
  keysHeld: number;
  /** Connection ids that became traversable at this level. */
  gatesOpened: string[];
}

/**
 * The reachability walk emitted as data rather than as a verdict.
 *
 * An instrument reports what it measured before it reports a result: a
 * document with no rooms is `measured: false` (nothing was walked), which is
 * *not* the same as a clean pass.
 */
export interface ReachabilityLedger {
  /** False when there was nothing to walk (no rooms). Never read as a pass. */
  measured: boolean;
  /**
   * True when the closure could account for every gate in the document —
   * i.e. no connection carries an unparseable prose gate. It says nothing
   * about whether the level is solvable; the findings say that. False means
   * the reachable set is an estimate, not a proof.
   */
  proven: boolean;
  roomsTotal: number;
  /** Rooms reachable at the closure fixpoint (locked doors NOT walked). */
  roomsReached: number;
  /** Rooms reachable when gates are ignored entirely (structural connectivity). */
  roomsStructurallyReached: number;
  /** Start rooms the walk seeded from. */
  seeds: string[];
  /** Ordered closure levels: the reachable-set size at each key level. */
  levels: GateClosureLevel[];
  /** Connections carrying a machine-readable `requires`. */
  gatesTotal: number;
  /** Connection ids whose requirement was never satisfied at the fixpoint. */
  gatesResidual: string[];
  /** Connection ids with prose `condition` but no `requires` — unreadable gates. */
  undeclaredGates: string[];
  /** Distinct key/flag identifiers granted by any room in the document. */
  keysPlaced: number;
  /** Key/flag identifiers held at the fixpoint. */
  keysHeld: string[];
}

export interface PacingLintResult {
  findings: PacingFinding[];
  /** Findings grouped by primary room id for inline badges. */
  byRoom: Record<string, PacingFinding[]>;
  /** Severity counts for summary chips. */
  counts: Record<PacingSeverity, number>;
  /** What the reachability walk actually saw. See {@link ReachabilityLedger}. */
  reachability: ReachabilityLedger;
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

// ── Gate & key model ──
//
// A connection's `condition` is authored prose: no traversal can read it. The
// machine-readable gate is `requires` — key/flag ids that must all be held.
// Everything below treats a connection with no `requires` as ungated, so a
// document written before gates existed walks exactly as it always did.

function normaliseKeys(keys: string[] | undefined): string[] {
  if (!keys) return [];
  return Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)));
}

/** The machine-readable requirement of a connection ([] when ungated). */
function gateKeys(c: RoomConnection): string[] {
  return normaliseKeys(c.requires);
}

function hasDeclaredGate(c: RoomConnection): boolean {
  return gateKeys(c).length > 0;
}

/** Prose in `condition` with nothing a checker can resolve — a gate as a comment. */
function hasUndeclaredGate(c: RoomConnection): boolean {
  return !hasDeclaredGate(c) && (c.condition ?? '').trim().length > 0;
}

function gateSatisfied(
  c: RoomConnection,
  held: ReadonlySet<string>,
  forcedOpen?: ReadonlySet<string>,
): boolean {
  if (forcedOpen?.has(c.id)) return true;
  return gateKeys(c).every((k) => held.has(k));
}

function buildAdjacency(
  rooms: RoomNode[],
  connections: RoomConnection[],
  /**
   * Key/flag identifiers the player currently holds. Omit for a *structural*
   * walk that ignores gates entirely (what this function always did).
   */
  held?: ReadonlySet<string>,
  /** Connection ids to treat as traversable whatever their gate says. */
  forcedOpen?: ReadonlySet<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of rooms) adj.set(r.id, []);
  for (const c of connections) {
    if (held && !gateSatisfied(c, held, forcedOpen)) continue;
    adj.get(c.fromId)?.push(c.toId);
    if (c.bidirectional) adj.get(c.toId)?.push(c.fromId);
  }
  return adj;
}

function reachFrom(seeds: string[], adj: Map<string, string[]>): Set<string> {
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
  return seen;
}

/**
 * Start rooms for a reachability walk: the first arc entry, then every room
 * with no incoming edge, else the first room. Unchanged from the original
 * ungated walk so gateless documents seed identically.
 */
function resolveSeeds(doc: LevelDesignDocument): string[] {
  if (doc.rooms.length === 0) return [];
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
  const noIncoming = doc.rooms.filter((r) => (incoming.get(r.id) ?? 0) === 0).map((r) => r.id);
  if (arcStart) return [arcStart, ...noIncoming.filter((id) => id !== arcStart)];
  return noIncoming.length > 0 ? noIncoming : [doc.rooms[0].id];
}

interface ClosureRun {
  /** Rooms reachable at the fixpoint. */
  reached: Set<string>;
  /** Keys held at the fixpoint. */
  held: Set<string>;
  levels: GateClosureLevel[];
  /** Closure level at which each reached room first became reachable. */
  roomLevel: Map<string, number>;
}

/**
 * Gate-and-key reachability as a fixed-point closure: walk with the keys
 * currently held, collect the keys lying in the rooms reached, walk again,
 * repeat until the reachable set stops growing.
 *
 * A fixpoint — not a loop over gates — because the failure that reaches
 * production is a *cycle* (A's key behind B, B's key behind A), which every
 * per-gate predicate passes.
 */
function runClosure(
  rooms: RoomNode[],
  connections: RoomConnection[],
  seeds: string[],
  forcedOpen?: ReadonlySet<string>,
): ClosureRun {
  const grantsByRoom = new Map(rooms.map((r) => [r.id, normaliseKeys(r.grants)] as const));
  const held = new Set<string>();
  const roomLevel = new Map<string, number>();
  const levels: GateClosureLevel[] = [];
  const opened = new Set<string>();
  let level = 0;
  let reached = reachFrom(seeds, buildAdjacency(rooms, connections, held, forcedOpen));

  for (;;) {
    for (const id of reached) {
      if (!roomLevel.has(id)) roomLevel.set(id, level);
    }
    const openedNow = connections
      .filter(
        (c) =>
          hasDeclaredGate(c) &&
          !opened.has(c.id) &&
          gateSatisfied(c, held, forcedOpen) &&
          (reached.has(c.fromId) || (c.bidirectional && reached.has(c.toId))),
      )
      .map((c) => c.id);
    for (const id of openedNow) opened.add(id);
    levels.push({ level, roomsReached: reached.size, keysHeld: held.size, gatesOpened: openedNow });

    const fresh: string[] = [];
    for (const id of reached) {
      for (const k of grantsByRoom.get(id) ?? []) {
        if (!held.has(k)) fresh.push(k);
      }
    }
    if (fresh.length === 0) break;
    for (const k of fresh) held.add(k);
    level++;
    reached = reachFrom(seeds, buildAdjacency(rooms, connections, held, forcedOpen));
  }

  return { reached, held, levels, roomLevel };
}

interface GateAnalysis {
  seeds: string[];
  closure: ClosureRun;
  /** Rooms reachable when gates are ignored — plain structural connectivity. */
  structural: Set<string>;
  /** Declared gates whose requirement was never satisfied. */
  blocked: RoomConnection[];
  /** Blocked gates the player can actually stand in front of. */
  frontier: RoomConnection[];
  undeclared: RoomConnection[];
  /** key id → rooms that grant it. */
  keySources: Map<string, string[]>;
  declaredGates: RoomConnection[];
}

function analyseGates(doc: LevelDesignDocument): GateAnalysis {
  const seeds = resolveSeeds(doc);
  const closure = runClosure(doc.rooms, doc.connections, seeds);
  const structural = reachFrom(seeds, buildAdjacency(doc.rooms, doc.connections));

  const keySources = new Map<string, string[]>();
  for (const r of doc.rooms) {
    for (const k of normaliseKeys(r.grants)) {
      keySources.set(k, [...(keySources.get(k) ?? []), r.id]);
    }
  }

  const declaredGates = doc.connections.filter(hasDeclaredGate);
  const blocked = declaredGates.filter((c) => !gateSatisfied(c, closure.held));
  const frontier = blocked.filter(
    (c) => closure.reached.has(c.fromId) || (c.bidirectional && closure.reached.has(c.toId)),
  );

  return {
    seeds,
    closure,
    structural,
    blocked,
    frontier,
    undeclared: doc.connections.filter(hasUndeclaredGate),
    keySources,
    declaredGates,
  };
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

// ── Rule: unreachable rooms (structurally, and behind gates that never open) ──

function connLabel(c: RoomConnection, byId: Map<string, RoomNode>): string {
  const from = roomLabel(byId.get(c.fromId), c.fromId);
  const to = roomLabel(byId.get(c.toId), c.toId);
  return `${from} ${c.bidirectional ? '<->' : '->'} ${to}`;
}

function lintReachability(doc: LevelDesignDocument, a: GateAnalysis): PacingFinding[] {
  if (doc.rooms.length === 0) return [];
  const byId = new Map(doc.rooms.map((r) => [r.id, r] as const));
  const blockingLabels = a.frontier.slice(0, 3).map((c) => connLabel(c, byId));

  const findings: PacingFinding[] = [];
  for (const room of doc.rooms) {
    if (a.closure.reached.has(room.id)) continue;

    if (a.structural.has(room.id)) {
      // Connected on paper, but every route in crosses a lock that never opens.
      const missing = Array.from(
        new Set(a.frontier.flatMap((c) => gateKeys(c).filter((k) => !a.closure.held.has(k)))),
      );
      findings.push({
        id: makeId('gated-unreachable', room.id),
        ruleId: 'gated-unreachable',
        severity: 'critical',
        roomIds: [room.id],
        title: 'Room locked out by a gate',
        message: `${roomLabel(room, room.id)} is connected to the level, but every route into it crosses a gate that never opens${blockingLabels.length > 0 ? ` (${blockingLabels.join('; ')})` : ''}. Players reach the door and stop there.`,
        suggestion:
          missing.length > 0
            ? `Grant ${missing.map((k) => `"${k}"`).join(', ')} from a room reachable before the gate, or drop the requirement.`
            : `Open a route into ${roomLabel(room, 'this room')} that does not depend on a locked connection.`,
      });
      continue;
    }

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
  return findings;
}

// ── Rule: gate/key solvability (inversion, deadlock, undeclared gate) ──

/**
 * True when every room granting `keyRooms` becomes structurally unreachable
 * once this one connection is removed — i.e. the key really does sit behind
 * this gate, rather than behind some other lock in a cycle.
 */
function keyIsBehindGate(
  doc: LevelDesignDocument,
  seeds: string[],
  gate: RoomConnection,
  keyRooms: string[],
): boolean {
  const without = doc.connections.filter((c) => c.id !== gate.id);
  const reach = reachFrom(seeds, buildAdjacency(doc.rooms, without));
  return keyRooms.every((id) => !reach.has(id));
}

function lintGates(doc: LevelDesignDocument, a: GateAnalysis): PacingFinding[] {
  const findings: PacingFinding[] = [];
  const byId = new Map(doc.rooms.map((r) => [r.id, r] as const));

  // 1. Gates explained on their own: the key is unplaced, or sits behind this
  //    very gate. Named specifically — key, gate, gate level, key level.
  const explained = new Set<string>();
  for (const gate of a.frontier) {
    const missing = gateKeys(gate).filter((k) => !a.closure.held.has(k));
    const unplaced = missing.filter((k) => (a.keySources.get(k) ?? []).length === 0);
    const inverted = missing.filter((k) => {
      const rooms = a.keySources.get(k) ?? [];
      return rooms.length > 0 && keyIsBehindGate(doc, a.seeds, gate, rooms);
    });
    if (unplaced.length === 0 && inverted.length === 0) continue;
    explained.add(gate.id);

    const reasons = [
      ...inverted.map((k) => {
        const rooms = (a.keySources.get(k) ?? [])
          .map((id) => roomLabel(byId.get(id), id))
          .join(', ');
        return `"${k}" is granted only in ${rooms}, which sits behind this very gate`;
      }),
      ...unplaced.map((k) => `"${k}" is granted by no room in this level`),
    ];
    const keyRoomIds = [...inverted, ...unplaced].flatMap((k) => a.keySources.get(k) ?? []);
    const gateLevel = a.closure.roomLevel.get(gate.fromId) ?? 0;

    findings.push({
      id: makeId('unwinnable-gate', gate.id),
      ruleId: 'unwinnable-gate',
      severity: 'critical',
      roomIds: Array.from(new Set([gate.fromId, gate.toId, ...keyRoomIds])).filter((id) =>
        byId.has(id),
      ),
      title: 'Unwinnable gate',
      message: `${connLabel(gate, byId)} requires ${gateKeys(gate).map((k) => `"${k}"`).join(', ')}. ${reasons.join('; ')}. The gate stands at key level ${gateLevel}; its key resolves at no level below that, so the door never opens.`,
      suggestion: `Move the ${[...inverted, ...unplaced].map((k) => `"${k}"`).join(', ')} pickup into a room reachable before ${roomLabel(byId.get(gate.fromId), gate.fromId)}, or drop the requirement from this connection.`,
    });
  }

  // 2. Whatever is still locked once those are accounted for is a deadlock —
  //    a cycle has no single guilty gate, so it is ONE finding over the whole
  //    residual set. Naming one arbitrarily would send the fix to the wrong place.
  const settled = runClosure(doc.rooms, doc.connections, a.seeds, explained);
  const residual = a.declaredGates.filter(
    (c) =>
      !explained.has(c.id) &&
      !gateSatisfied(c, settled.held, explained) &&
      (settled.reached.has(c.fromId) || (c.bidirectional && settled.reached.has(c.toId))),
  );

  if (residual.length > 0) {
    const stranded = doc.rooms.filter(
      (r) => a.structural.has(r.id) && !settled.reached.has(r.id),
    );
    const strandedIds = new Set(stranded.map((r) => r.id));
    const bossRooms = doc.rooms.filter((r) => r.type === 'boss');
    const strandedBosses = bossRooms.filter((r) => strandedIds.has(r.id));

    // A cycle among optional gates is content nobody sees; a cycle that strands
    // the objective is a hard failure. With no objective declared we cannot
    // claim it survives, so we do not soften the grade.
    const objectiveNote =
      bossRooms.length === 0
        ? 'No boss room is declared, so whether the objective survives this deadlock cannot be answered.'
        : strandedBosses.length > 0
          ? `The objective (${strandedBosses.map((r) => roomLabel(r, r.id)).join(', ')}) is stranded behind it.`
          : 'The objective is still reachable, so this strands optional content.';
    const severity: PacingSeverity =
      bossRooms.length === 0 || strandedBosses.length > 0 ? 'critical' : 'warning';

    const residualKeys = Array.from(
      new Set(residual.flatMap((c) => gateKeys(c).filter((k) => !settled.held.has(k)))),
    );

    findings.push({
      id: makeId('gate-deadlock', residual.map((c) => c.id).sort().join('+')),
      ruleId: 'gate-deadlock',
      severity,
      roomIds: stranded.length > 0 ? stranded.map((r) => r.id) : residual.map((c) => c.fromId),
      title: `Gate deadlock (${residual.length} gates)`,
      message: `${residual.map((c) => connLabel(c, byId)).join('; ')} — none of these gates can ever open: each one's key sits behind another. Stranded: ${stranded.map((r) => roomLabel(r, r.id)).join(', ') || 'none'}. ${objectiveNote}`,
      suggestion: `Move any ONE of ${residualKeys.map((k) => `"${k}"`).join(', ')} into the region reachable without keys. Which one is a design call — the closure deliberately does not guess.`,
    });
  }

  // 3. A gate whose condition is free text is not a gate; it is a comment.
  for (const c of a.undeclared) {
    findings.push({
      id: makeId('undeclared-gate', c.id),
      ruleId: 'undeclared-gate',
      severity: 'warning',
      roomIds: [c.fromId, c.toId].filter((id) => byId.has(id)),
      title: 'Undeclared gate',
      message: `${connLabel(c, byId)} carries the condition "${c.condition.trim()}" as prose with no machine-readable \`requires\`. No traversal can read it, so the reachability walk crossed this door as if it were open — the document says the level is gated while every automated reader says it is not.`,
      suggestion: `Add \`requires: ["some-key-id"]\` to this connection and grant that id from a room (\`grants: [...]\`), so the solvability closure can order this gate.`,
    });
  }

  return findings;
}

// ── Public entry point ──

export function lintLevelPacing(doc: LevelDesignDocument): PacingLintResult {
  const arc = resolveArc(doc);
  const gates = analyseGates(doc);
  const measured = doc.rooms.length > 0;

  const findings: PacingFinding[] = measured
    ? [
        ...lintConsecutiveCombat(arc),
        ...lintDifficultyCliff(arc),
        ...lintMonotonicRamp(arc),
        ...lintNoSafeBeforeBoss(doc),
        ...lintGates(doc, gates),
        ...lintReachability(doc, gates),
      ]
    : [];

  const reachability: ReachabilityLedger = {
    measured,
    // An empty document proved nothing; prose gates leave the walk an estimate.
    proven: measured && gates.undeclared.length === 0,
    roomsTotal: doc.rooms.length,
    roomsReached: gates.closure.reached.size,
    roomsStructurallyReached: gates.structural.size,
    seeds: gates.seeds,
    levels: gates.closure.levels,
    gatesTotal: gates.declaredGates.length,
    gatesResidual: gates.blocked.map((c) => c.id),
    undeclaredGates: gates.undeclared.map((c) => c.id),
    keysPlaced: new Set(doc.rooms.flatMap((r) => normaliseKeys(r.grants))).size,
    keysHeld: Array.from(gates.closure.held),
  };

  const byRoom: Record<string, PacingFinding[]> = {};
  for (const f of findings) {
    const anchor = f.roomIds[0];
    if (!anchor) continue;
    (byRoom[anchor] ??= []).push(f);
  }

  const counts: Record<PacingSeverity, number> = { info: 0, warning: 0, critical: 0 };
  for (const f of findings) counts[f.severity]++;

  return { findings, byRoom, counts, reachability };
}

export const RULE_LABELS: Record<PacingRuleId, string> = {
  'consecutive-combat': 'Consecutive Combat',
  'difficulty-cliff': 'Difficulty Cliff',
  'monotonic-ramp': 'Monotonic Ramp',
  'no-safe-before-boss': 'No Safe Before Boss',
  'unreachable-room': 'Unreachable Room',
  'gated-unreachable': 'Locked Out By Gate',
  'unwinnable-gate': 'Unwinnable Gate',
  'gate-deadlock': 'Gate Deadlock',
  'undeclared-gate': 'Undeclared Gate',
};
