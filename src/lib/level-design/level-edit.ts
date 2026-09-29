/**
 * Level-design edits as named ops — the one reducer every flow-editor gesture
 * goes through, plus the undo history built on it.
 *
 * `applyLevelEdit(doc, op)` is pure and decides three things per op that used
 * to be scattered across whole-array setters (or missing):
 *   - the PATCH: only the document keys the op touched, with every reference to
 *     something it removed pruned in the same patch (a deleted room leaves no
 *     link, arc id or sync-report row behind) — so one act is one write;
 *   - the INVERSE: the prior values of exactly those keys (snapshot-of-touched-
 *     keys, so it cannot drift from the forward op);
 *   - the SYNC consequence (`marksDocAhead`): decided by the op, not the setter.
 *
 * Adding an op: extend `LevelEditOp`, add a case to `applyLevelEdit` (return
 * `edit(doc, patch)`), and give it a `gestureKey` / `describeLevelEdit` line.
 * Every op then gets one-commit persistence and undo for free.
 */
import type { LevelDesignDocument, RoomConnection, RoomNode, UpdateDocPayload } from '@/types/level-design';
import { ok, err, type Result } from '@/types/result';
import { applyLinkChange, applyGateDeclaration, type LinkChange } from '@/lib/level-design/gate-authoring';

/** Everything a level-design PUT can carry, minus the row id. */
export type LevelDocPatch = Omit<UpdateDocPayload, 'id'>;

export type LevelEditOp =
  | { kind: 'add-room'; room: RoomNode }
  /** Absolute position — a drag frame. */
  | { kind: 'move-room'; roomId: string; x: number; y: number }
  /** Relative move applied to the doc it lands on — a held arrow key. */
  | { kind: 'nudge-room'; roomId: string; dx: number; dy: number }
  /** Replace a room by id (the detail panel's field edits). */
  | { kind: 'update-room'; room: RoomNode }
  | { kind: 'delete-room'; roomId: string }
  | { kind: 'link'; fromId: string; toId: string }
  | { kind: 'unlink'; connectionId: string }
  /** The link inspector's Apply: direction, condition, required keys and the granting room. */
  | { kind: 'set-link-gate'; connectionId: string; change: LinkChange }
  /** Turn a prose condition into a declared key granted by a room reachable before the gate. */
  | { kind: 'declare-gate'; connectionId: string; key: string; grantRoomId: string };

export interface LevelEdit {
  patch: LevelDocPatch;
  inverse: LevelDocPatch;
  /** Escalate a `synced` doc to `doc-ahead` when this edit is committed. */
  marksDocAhead: boolean;
}

/** Build the edit for `patch`: the inverse is the prior value of each touched key. */
function edit(doc: LevelDesignDocument, patch: LevelDocPatch, marksDocAhead = true): Result<LevelEdit, string> {
  const inverse: LevelDocPatch = {};
  for (const key of Object.keys(patch) as (keyof LevelDocPatch)[]) {
    (inverse as Record<string, unknown>)[key] = doc[key as keyof LevelDesignDocument];
  }
  return ok({ patch, inverse, marksDocAhead });
}

const roomName = (doc: LevelDesignDocument, id: string) => doc.rooms.find((r) => r.id === id)?.name ?? id;
const hasRoom = (doc: LevelDesignDocument, id: string) => doc.rooms.some((r) => r.id === id);

function mapRoom(doc: LevelDesignDocument, roomId: string, fn: (r: RoomNode) => RoomNode): Result<LevelEdit, string> {
  if (!hasRoom(doc, roomId)) return err(`Room "${roomId}" is not in this document.`);
  return edit(doc, { rooms: doc.rooms.map((r) => (r.id === roomId ? fn(r) : r)) });
}

/** A connection id no other connection in the doc uses (deterministic, so redo is stable). */
function connectionId(doc: LevelDesignDocument, fromId: string, toId: string): string {
  const taken = new Set(doc.connections.map((c) => c.id));
  const base = `conn-${fromId}-${toId}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function applyLevelEdit(doc: LevelDesignDocument, op: LevelEditOp): Result<LevelEdit, string> {
  switch (op.kind) {
    case 'add-room':
      if (hasRoom(doc, op.room.id)) return err(`A room with id "${op.room.id}" already exists.`);
      return edit(doc, { rooms: [...doc.rooms, op.room] });

    case 'move-room':
      return mapRoom(doc, op.roomId, (r) => ({ ...r, x: op.x, y: op.y }));

    case 'nudge-room':
      return mapRoom(doc, op.roomId, (r) => ({ ...r, x: r.x + op.dx, y: r.y + op.dy }));

    case 'update-room':
      return mapRoom(doc, op.room.id, () => op.room);

    case 'delete-room': {
      if (!hasRoom(doc, op.roomId)) return err(`Room "${op.roomId}" is not in this document.`);
      const id = op.roomId;
      const patch: LevelDocPatch = { rooms: doc.rooms.filter((r) => r.id !== id) };
      const connections = doc.connections.filter((c) => c.fromId !== id && c.toId !== id);
      if (connections.length !== doc.connections.length) patch.connections = connections;
      const difficultyArc = doc.difficultyArc.filter((r) => r !== id);
      if (difficultyArc.length !== doc.difficultyArc.length) patch.difficultyArc = difficultyArc;
      // A sync row for a deleted room would keep a live "Fix code" button for a
      // room that no longer exists.
      const syncReport = doc.syncReport.filter((d) => d.roomId !== id);
      if (syncReport.length !== doc.syncReport.length) patch.syncReport = syncReport;
      return edit(doc, patch);
    }

    case 'link': {
      const { fromId, toId } = op;
      if (fromId === toId) return err('A room cannot link to itself.');
      if (!hasRoom(doc, fromId) || !hasRoom(doc, toId)) return err('Both rooms must be in this document.');
      const exists = doc.connections.some(
        (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId),
      );
      if (exists) return err(`${roomName(doc, fromId)} and ${roomName(doc, toId)} are already linked.`);
      const conn: RoomConnection = {
        id: connectionId(doc, fromId, toId), fromId, toId, bidirectional: true, condition: '',
      };
      // The codegen prompt emits every connection, so a link edit changes the
      // code the document implies — it marks the doc ahead like a room edit.
      return edit(doc, { connections: [...doc.connections, conn] });
    }

    case 'unlink':
      if (!doc.connections.some((c) => c.id === op.connectionId)) return err('That link is not in this document.');
      return edit(doc, { connections: doc.connections.filter((c) => c.id !== op.connectionId) });

    // Gate ops: one {connections[, rooms]} patch each, so a lock and its key are
    // one write and one undo step. Both change what codegen emits (doc ahead).
    case 'set-link-gate': {
      const res = applyLinkChange(doc, op.connectionId, op.change);
      if (!res.ok) return res;
      if (Object.keys(res.data).length === 0) return err('Nothing to change on this link.');
      return edit(doc, res.data);
    }

    case 'declare-gate': {
      const res = applyGateDeclaration(doc, op.connectionId, op.key, op.grantRoomId);
      return res.ok ? edit(doc, res.data) : res;
    }
  }
}

const linkLabel = (doc: LevelDesignDocument, connectionId: string): string => {
  const c = doc.connections.find((x) => x.id === connectionId);
  return c ? `${roomName(doc, c.fromId)} to ${roomName(doc, c.toId)}` : 'link';
};

/**
 * Ops with the same key in a row are ONE gesture (one undo entry): a drag and
 * the arrow nudges of one room, or a typing burst in one field of one room.
 */
export function gestureKey(op: LevelEditOp, doc: LevelDesignDocument): string {
  switch (op.kind) {
    case 'move-room':
    case 'nudge-room':
      return `move:${op.roomId}`;
    case 'update-room': {
      const prev = doc.rooms.find((r) => r.id === op.room.id);
      const fields = prev
        ? (Object.keys(op.room) as (keyof RoomNode)[]).filter((k) => op.room[k] !== prev[k]).sort().join(',')
        : '';
      return `update:${op.room.id}:${fields}`;
    }
    case 'add-room': return `add:${op.room.id}`;
    case 'delete-room': return `delete:${op.roomId}`;
    case 'link': return `link:${op.fromId}:${op.toId}`;
    case 'unlink': return `unlink:${op.connectionId}`;
    case 'set-link-gate':
    case 'declare-gate': return `gate:${op.connectionId}`;
  }
}

/** Human label for the Undo/Redo affordance ("Undo: Move Entry Hall"). */
export function describeLevelEdit(op: LevelEditOp, doc: LevelDesignDocument): string {
  switch (op.kind) {
    case 'add-room': return `Add ${op.room.name}`;
    case 'move-room':
    case 'nudge-room': return `Move ${roomName(doc, op.roomId)}`;
    case 'update-room': return `Edit ${op.room.name}`;
    case 'delete-room': return `Delete ${roomName(doc, op.roomId)}`;
    case 'link': return `Link ${roomName(doc, op.fromId)} to ${roomName(doc, op.toId)}`;
    case 'unlink': return 'Remove link';
    case 'set-link-gate': return `Edit link ${linkLabel(doc, op.connectionId)}`;
    case 'declare-gate': return `Declare gate ${op.key}`;
  }
}

// ── History ──

export const EDIT_HISTORY_LIMIT = 50;

export interface EditHistoryEntry {
  label: string;
  /** Applied by Undo: the pre-gesture values of every key the gesture touched. */
  undo: LevelDocPatch;
  /** Applied by Redo: the post-gesture values of the same keys. */
  redo: LevelDocPatch;
}

export interface OpenGesture extends EditHistoryEntry { key: string }

export interface EditHistory {
  /** The document these entries belong to — history never crosses documents. */
  docId: number | null;
  past: EditHistoryEntry[];
  future: EditHistoryEntry[];
}

export const emptyEditHistory = (docId: number | null): EditHistory => ({ docId, past: [], future: [] });

/**
 * Fold one op into the open gesture. A different key closes the open gesture
 * (returned as `closed`, ready to record) and opens a new one. Within a gesture
 * the EARLIEST inverse of each key wins (captured on the first frame) and the
 * latest forward value wins.
 */
export function extendGesture(
  open: OpenGesture | null, key: string, label: string, e: LevelEdit,
): { closed: EditHistoryEntry | null; pending: OpenGesture } {
  if (open && open.key === key) {
    return {
      closed: null,
      pending: { ...open, undo: { ...e.inverse, ...open.undo }, redo: { ...open.redo, ...e.patch } },
    };
  }
  const closed = open ? { label: open.label, undo: open.undo, redo: open.redo } : null;
  return { closed, pending: { key, label, undo: { ...e.inverse }, redo: { ...e.patch } } };
}

/** Push a closed gesture: drops the oldest past the limit, forks away any redo. */
export function recordEdit(h: EditHistory, entry: EditHistoryEntry): EditHistory {
  const past = [...h.past, entry];
  return { ...h, past: past.slice(Math.max(0, past.length - EDIT_HISTORY_LIMIT)), future: [] };
}

export function undoStep(h: EditHistory): { history: EditHistory; entry: EditHistoryEntry } | null {
  const entry = h.past.at(-1);
  if (!entry) return null;
  return { entry, history: { ...h, past: h.past.slice(0, -1), future: [...h.future, entry] } };
}

export function redoStep(h: EditHistory): { history: EditHistory; entry: EditHistoryEntry } | null {
  const entry = h.future.at(-1);
  if (!entry) return null;
  return { entry, history: { ...h, past: [...h.past, entry], future: h.future.slice(0, -1) } };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Make a history patch safe to apply to the LIVE doc. `expected` is what each
 * key should hold right now if nothing outside this history touched it (the
 * entry's `redo` for an undo, its `undo` for a redo).
 *
 *   - `syncReport` rewritten since (a Check Sync landed between the edit and the
 *     undo): the live report is newer evidence, so it is kept — an undo must
 *     never resurrect stale divergence rows.
 *   - any other key rewritten since (e.g. "adopt code" edited a room): the
 *     entry no longer describes this document — refused, and the caller drops
 *     the history rather than overwrite someone else's change.
 */
export function rebaseHistoryPatch(
  live: LevelDesignDocument, patch: LevelDocPatch, expected: LevelDocPatch,
): Result<LevelDocPatch, string> {
  const out: LevelDocPatch = {};
  for (const key of Object.keys(patch) as (keyof LevelDocPatch)[]) {
    const drifted = !same(live[key as keyof LevelDesignDocument], expected[key]);
    if (drifted && key === 'syncReport') continue;
    if (drifted) return err('The document changed outside the editor since this edit, so the undo history was cleared.');
    (out as Record<string, unknown>)[key] = patch[key];
  }
  return ok(out);
}
