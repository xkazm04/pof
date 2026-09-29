/**
 * Gate authoring — the writers for locks, keys and one-way doors.
 *
 * The level model carries `RoomConnection.requires` (a machine-readable lock),
 * `RoomNode.grants` (the key a room hands out), `bidirectional` and the prose
 * `condition`, and `lintLevelPacing` proves a gate-and-key closure over them.
 * These pure helpers turn a designer's intent into ONE document patch each (or
 * a reason it was refused); `level-edit.ts` wraps them as the `set-link-gate`
 * and `declare-gate` ops, so each is one write and one undo step.
 *
 * Grant candidates come from the linter itself, not a copy of its walk: the
 * gate in question is held shut with a key no room grants, and every room the
 * closure still reaches (no `unreachable-room` / `gated-unreachable` finding) is
 * a room whose key the player can collect before standing at that door.
 */
import type { LevelDesignDocument, RoomConnection, RoomNode } from '@/types/level-design';
import { lintLevelPacing } from '@/lib/level-design/pacing-linter';
import type { LevelDocPatch } from '@/lib/level-design/level-edit';
import { ok, err, type Result } from '@/types/result';

/** What the gate helpers read — a full document satisfies it. */
export type GateGraph = Pick<LevelDesignDocument, 'rooms' | 'connections' | 'difficultyArc'>;

export type LinkDirection = 'one-way' | 'two-way' | 'flip';

/** The link inspector's Apply: every field optional, applied in one patch. */
export interface LinkChange {
  direction?: LinkDirection;
  /** Swap the ends (applied before `direction`), so one Apply can flip AND set one-way. */
  flip?: boolean;
  condition?: string;
  requires?: string[];
  /** Room that grants every key this link requires (after the change). */
  grantRoomId?: string;
}

export interface GateProposal {
  connectionId: string;
  key: string;
  /** Rooms reachable with THIS gate shut — where the key may be placed. */
  grantCandidates: string[];
}

export interface KeyLedger {
  keys: Record<string, { grantedBy: string[]; requiredBy: string[] }>;
  /** Required by a link, granted by no room. */
  orphanRequires: string[];
  /** Granted by a room, required by no link. */
  unusedGrants: string[];
}

/** ' Brass Key ' -> 'brass-key'. Lowercase, non-alphanumerics collapse to one dash. */
export function normaliseKeyId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normaliseKeyIds(raw: readonly string[]): string[] {
  return Array.from(new Set(raw.map(normaliseKeyId).filter(Boolean)));
}

/** The keys as the linter reads them (trimmed, deduped) — never re-slugs stored data. */
export const storedKeyIds = (keys: string[] | undefined): string[] =>
  Array.from(new Set((keys ?? []).map((k) => k.trim()).filter(Boolean)));

function findLink(g: GateGraph, connectionId: string): Result<RoomConnection, string> {
  const c = g.connections.find((x) => x.id === connectionId);
  return c ? ok(c) : err('That link is not in this document.');
}

function replaceLink(g: GateGraph, next: RoomConnection): LevelDocPatch {
  return { connections: g.connections.map((c) => (c.id === next.id ? next : c)) };
}

export function setLinkGate(
  g: GateGraph, connectionId: string, change: { requires?: string[]; bidirectional?: boolean; condition?: string },
): Result<LevelDocPatch, string> {
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  const next: RoomConnection = { ...found.data };
  if (change.bidirectional !== undefined) next.bidirectional = change.bidirectional;
  if (change.condition !== undefined) next.condition = change.condition.trim();
  if (change.requires !== undefined) {
    const keys = normaliseKeyIds(change.requires);
    if (keys.length > 0) next.requires = keys;
    else delete next.requires;
  }
  return ok(replaceLink(g, next));
}

export function setLinkDirection(g: GateGraph, connectionId: string, direction: LinkDirection): Result<LevelDocPatch, string> {
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  const c = found.data;
  if (direction === 'flip') return ok(replaceLink(g, { ...c, fromId: c.toId, toId: c.fromId }));
  return ok(replaceLink(g, { ...c, bidirectional: direction === 'two-way' }));
}

/** A key id no room can grant: holds the probed gate shut for the trial lint. */
const SHUT = '__gate-authoring-probe__';

function asLintDoc(g: GateGraph): LevelDesignDocument {
  return {
    id: 0, name: '', description: '', designNarrative: '', pacingNotes: '', syncStatus: 'unlinked',
    syncReport: [], lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
    rooms: g.rooms, connections: g.connections, difficultyArc: g.difficultyArc,
  };
}

/** Rooms the closure reaches with `connectionId` shut, in document order. */
export function grantCandidates(g: GateGraph, connectionId: string): Result<string[], string> {
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  const shut = replaceLink(g, { ...found.data, requires: [SHUT] });
  const { findings } = lintLevelPacing(asLintDoc({ ...g, ...shut }));
  const locked = new Set(
    findings
      .filter((f) => f.ruleId === 'unreachable-room' || f.ruleId === 'gated-unreachable')
      .map((f) => f.roomIds[0]),
  );
  return ok(g.rooms.filter((r) => !locked.has(r.id)).map((r) => r.id));
}

/** Give `roomId` every key in `keys` it does not already grant. */
function grantFrom(g: GateGraph, connectionId: string, roomId: string, keys: string[]): Result<LevelDocPatch, string> {
  const target = g.rooms.find((r) => r.id === roomId);
  if (!target) return err(`Room "${roomId}" is not in this document.`);
  const candidates = grantCandidates(g, connectionId);
  if (!candidates.ok) return candidates;
  if (!candidates.data.includes(roomId)) {
    return err(
      `${target.name} is reachable only through this gate — a key granted there sits behind its own lock. ` +
      'Grant it from a room the player reaches first.',
    );
  }
  const held = storedKeyIds(target.grants);
  const fresh = keys.filter((k) => !held.includes(k));
  if (fresh.length === 0) return ok({});
  const next: RoomNode = { ...target, grants: [...held, ...fresh] };
  return ok({ rooms: g.rooms.map((r) => (r.id === roomId ? next : r)) });
}

export function declareGateFromCondition(g: GateGraph, connectionId: string): Result<GateProposal, string> {
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  if (storedKeyIds(found.data.requires).length > 0) return err('This link already declares its gate.');
  const key = normaliseKeyId(found.data.condition ?? '');
  if (!key) return err('This link has no condition to declare as a gate.');
  const candidates = grantCandidates(g, connectionId);
  if (!candidates.ok) return candidates;
  return ok({ connectionId, key, grantCandidates: candidates.data });
}

/** requires + grants as ONE patch; refuses a granting room behind this very gate. */
export function applyGateDeclaration(
  g: GateGraph, connectionId: string, key: string, grantRoomId: string,
): Result<LevelDocPatch, string> {
  const id = normaliseKeyId(key);
  if (!id) return err('A gate needs a key id.');
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  const grant = grantFrom(g, connectionId, grantRoomId, [id]);
  if (!grant.ok) return grant;
  const gate = setLinkGate(g, connectionId, { requires: [...storedKeyIds(found.data.requires), id] });
  if (!gate.ok) return gate;
  return ok({ ...gate.data, rooms: grant.data.rooms ?? g.rooms });
}

/**
 * The inspector's Apply: direction, condition, required keys and the granting
 * room folded into ONE patch holding only the keys that changed (`{}` when the
 * change changes nothing). The grant is checked against the link's NEW shape.
 */
export function applyLinkChange(g: GateGraph, connectionId: string, change: LinkChange): Result<LevelDocPatch, string> {
  const found = findLink(g, connectionId);
  if (!found.ok) return found;
  let work: GateGraph = g;
  if (change.flip) {
    const flipped = setLinkDirection(work, connectionId, 'flip');
    if (!flipped.ok) return flipped;
    work = { ...work, ...flipped.data };
  }
  if (change.direction) {
    const dir = setLinkDirection(work, connectionId, change.direction);
    if (!dir.ok) return dir;
    work = { ...work, ...dir.data };
  }
  const gate = setLinkGate(work, connectionId, { condition: change.condition, requires: change.requires });
  if (!gate.ok) return gate;
  work = { ...work, ...gate.data };

  if (change.grantRoomId) {
    const keys = storedKeyIds(work.connections.find((c) => c.id === connectionId)?.requires);
    if (keys.length === 0) return err('Add a required key before choosing a room to grant it.');
    const grant = grantFrom(work, connectionId, change.grantRoomId, keys);
    if (!grant.ok) return grant;
    work = { ...work, ...grant.data };
  }

  const patch: LevelDocPatch = {};
  const after = work.connections.find((c) => c.id === connectionId);
  if (JSON.stringify(after) !== JSON.stringify(found.data)) patch.connections = work.connections;
  if (work.rooms !== g.rooms) patch.rooms = work.rooms;
  return ok(patch);
}

/** Who grants and who requires each key, with the orphans both ways. */
export function keyLedger(g: GateGraph): KeyLedger {
  const keys: KeyLedger['keys'] = {};
  const slot = (k: string) => (keys[k] ??= { grantedBy: [], requiredBy: [] });
  for (const r of g.rooms) for (const k of storedKeyIds(r.grants)) slot(k).grantedBy.push(r.id);
  for (const c of g.connections) for (const k of storedKeyIds(c.requires)) slot(k).requiredBy.push(c.id);
  const ids = Object.keys(keys);
  return {
    keys,
    orphanRequires: ids.filter((k) => keys[k].requiredBy.length > 0 && keys[k].grantedBy.length === 0),
    unusedGrants: ids.filter((k) => keys[k].grantedBy.length > 0 && keys[k].requiredBy.length === 0),
  };
}
