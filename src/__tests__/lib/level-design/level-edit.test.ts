/**
 * level-edit — every flow-editor gesture is a named op with one reducer.
 *
 * `applyLevelEdit(doc, op)` decides, per op, the patch (only the keys the op
 * touched, with every reference to a removed thing pruned in the SAME patch),
 * the inverse (the prior values of exactly those keys) and the sync
 * consequence. The history helpers turn those into a bounded, per-document
 * undo stack whose gestures coalesce.
 */
import { describe, it, expect } from 'vitest';
import {
  applyLevelEdit,
  gestureKey,
  extendGesture,
  recordEdit,
  emptyEditHistory,
  undoStep,
  redoStep,
  rebaseHistoryPatch,
  EDIT_HISTORY_LIMIT,
  type EditHistoryEntry,
  type LevelDocPatch,
  type LevelEditOp,
} from '@/lib/level-design/level-edit';
import type { LevelDesignDocument, RoomNode, SyncDivergence } from '@/types/level-design';

const room = (id: string, x = 0): RoomNode => ({
  id, name: `Room ${id}`, type: 'combat', description: '', encounterDesign: '',
  difficulty: 2, pacing: 'rising', x, y: 0, linkedFiles: [], spawnEntries: [], tags: [],
});

const row = (roomId: string): SyncDivergence => ({
  roomId, roomName: `Room ${roomId}`, field: 'difficulty', docValue: '2', codeValue: '3',
  severity: 'warning', suggestion: 'align',
});

function makeDoc(): LevelDesignDocument {
  return {
    id: 7, name: 'Crypt', description: '', designNarrative: '',
    rooms: [room('r1'), room('r2', 200), room('r3', 400)],
    connections: [{ id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: true, condition: '' }],
    difficultyArc: ['r1', 'r2', 'r3'],
    pacingNotes: '', syncStatus: 'synced',
    syncReport: [row('r2'), row('r3')],
    lastGeneratedAt: null, lastCodeHash: 'abc',
    createdAt: '2026-09-28 10:00:00', updatedAt: '2026-09-28 10:00:00',
  };
}

const apply = (doc: LevelDesignDocument, patch: LevelDocPatch): LevelDesignDocument => ({ ...doc, ...patch });

describe('applyLevelEdit — delete-room', () => {
  it('prunes links, the arc and the sync rows in ONE patch, and marks the doc ahead', () => {
    const doc = makeDoc();
    const res = applyLevelEdit(doc, { kind: 'delete-room', roomId: 'r2' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { patch, inverse, marksDocAhead } = res.data;
    expect(Object.keys(patch).sort()).toEqual(['connections', 'difficultyArc', 'rooms', 'syncReport']);
    expect(patch.rooms?.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(patch.connections).toEqual([]);
    expect(patch.difficultyArc).toEqual(['r1', 'r3']);
    expect(patch.syncReport?.map((r) => r.roomId)).toEqual(['r3']);
    expect(marksDocAhead).toBe(true);
    // The inverse is the prior value of exactly the touched keys.
    expect(Object.keys(inverse).sort()).toEqual(Object.keys(patch).sort());
    expect(apply(apply(doc, patch), inverse)).toEqual(doc);
  });

  it('touches only the keys that actually referenced the room', () => {
    const res = applyLevelEdit(makeDoc(), { kind: 'delete-room', roomId: 'r1' });
    if (!res.ok) throw new Error(res.error);
    // r1 has a link and an arc entry but no sync row.
    expect(Object.keys(res.data.patch).sort()).toEqual(['connections', 'difficultyArc', 'rooms']);
  });

  it('refuses an unknown room', () => {
    expect(applyLevelEdit(makeDoc(), { kind: 'delete-room', roomId: 'nope' }).ok).toBe(false);
  });
});

describe('applyLevelEdit — link / unlink', () => {
  it('link adds one two-way connection and marks the doc ahead', () => {
    const res = applyLevelEdit(makeDoc(), { kind: 'link', fromId: 'r1', toId: 'r3' });
    if (!res.ok) throw new Error(res.error);
    expect(Object.keys(res.data.patch)).toEqual(['connections']);
    const added = res.data.patch.connections?.at(-1);
    expect(added).toMatchObject({ fromId: 'r1', toId: 'r3', bidirectional: true, condition: '' });
    expect(res.data.marksDocAhead).toBe(true);
    expect(res.data.inverse).toEqual({ connections: makeDoc().connections });
  });

  it('refuses a link that already exists in either direction', () => {
    const doc = makeDoc();
    doc.connections.push({ id: 'c2', fromId: 'r3', toId: 'r1', bidirectional: true, condition: '' });
    const res = applyLevelEdit(doc, { kind: 'link', fromId: 'r1', toId: 'r3' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already linked/);
  });

  it('refuses a self-link and an unknown room, with no patch', () => {
    expect(applyLevelEdit(makeDoc(), { kind: 'link', fromId: 'r1', toId: 'r1' }).ok).toBe(false);
    const unknown = applyLevelEdit(makeDoc(), { kind: 'link', fromId: 'r1', toId: 'ghost' });
    expect(unknown.ok).toBe(false);
    expect('data' in unknown).toBe(false);
  });

  it('unlink removes exactly that connection; unknown id is refused', () => {
    const res = applyLevelEdit(makeDoc(), { kind: 'unlink', connectionId: 'c1' });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.patch).toEqual({ connections: [] });
    expect(applyLevelEdit(makeDoc(), { kind: 'unlink', connectionId: 'zz' }).ok).toBe(false);
  });
});

describe('applyLevelEdit — room ops', () => {
  it('add-room refuses a duplicate id', () => {
    expect(applyLevelEdit(makeDoc(), { kind: 'add-room', room: room('r4') }).ok).toBe(true);
    expect(applyLevelEdit(makeDoc(), { kind: 'add-room', room: room('r1') }).ok).toBe(false);
  });

  it('move-room is absolute, nudge-room is relative to the doc it is applied to', () => {
    const moved = applyLevelEdit(makeDoc(), { kind: 'move-room', roomId: 'r1', x: 50, y: 60 });
    if (!moved.ok) throw new Error(moved.error);
    expect(moved.data.patch.rooms?.[0]).toMatchObject({ x: 50, y: 60 });
    const nudged = applyLevelEdit(makeDoc(), { kind: 'nudge-room', roomId: 'r2', dx: 10, dy: -10 });
    if (!nudged.ok) throw new Error(nudged.error);
    expect(nudged.data.patch.rooms?.[1]).toMatchObject({ x: 210, y: -10 });
  });

  it('update-room replaces the room by id and refuses an unknown one', () => {
    const res = applyLevelEdit(makeDoc(), { kind: 'update-room', room: { ...room('r3', 400), description: 'crypt' } });
    if (!res.ok) throw new Error(res.error);
    expect(res.data.patch.rooms?.[2].description).toBe('crypt');
    expect(applyLevelEdit(makeDoc(), { kind: 'update-room', room: room('zz') }).ok).toBe(false);
  });

  it('gesture keys group a drag with its nudges and a typing burst by field', () => {
    const doc = makeDoc();
    expect(gestureKey({ kind: 'move-room', roomId: 'r1', x: 1, y: 1 }, doc))
      .toBe(gestureKey({ kind: 'nudge-room', roomId: 'r1', dx: 1, dy: 0 }, doc));
    const desc = gestureKey({ kind: 'update-room', room: { ...room('r1'), description: 'a' } }, doc);
    const enc = gestureKey({ kind: 'update-room', room: { ...room('r1'), encounterDesign: 'a' } }, doc);
    expect(desc).not.toBe(enc);
  });
});

describe('gesture coalescing', () => {
  it('N frames of one gesture close as ONE entry whose undo is the pre-gesture value', () => {
    let doc = makeDoc();
    let pending: ReturnType<typeof extendGesture>['pending'] | null = null;
    const closed: EditHistoryEntry[] = [];
    for (let i = 1; i <= 12; i++) {
      const op = { kind: 'move-room', roomId: 'r1', x: i * 5, y: 0 } as const;
      const res = applyLevelEdit(doc, op);
      if (!res.ok) throw new Error(res.error);
      const next = extendGesture(pending, gestureKey(op, doc), 'Move', res.data);
      if (next.closed) closed.push(next.closed);
      pending = next.pending;
      doc = apply(doc, res.data.patch);
    }
    expect(closed).toHaveLength(0);
    expect(pending?.undo.rooms?.[0].x).toBe(0);
    expect(pending?.redo.rooms?.[0].x).toBe(60);
  });

  it('a different gesture key closes the open gesture', () => {
    const doc = makeDoc();
    const a = applyLevelEdit(doc, { kind: 'nudge-room', roomId: 'r1', dx: 1, dy: 0 });
    const b = applyLevelEdit(doc, { kind: 'nudge-room', roomId: 'r2', dx: 1, dy: 0 });
    if (!a.ok || !b.ok) throw new Error('op failed');
    const first = extendGesture(null, 'move:r1', 'Move', a.data);
    const second = extendGesture(first.pending, 'move:r2', 'Move', b.data);
    expect(second.closed?.label).toBe('Move');
    expect(second.pending.key).toBe('move:r2');
  });
});

describe('history stack', () => {
  const entry = (n: number): EditHistoryEntry => ({ label: `e${n}`, undo: { pacingNotes: `${n - 1}` }, redo: { pacingNotes: `${n}` } });

  it('is bounded: 60 committed edits keep the newest 50', () => {
    let h = emptyEditHistory(7);
    for (let i = 1; i <= 60; i++) h = recordEdit(h, entry(i));
    expect(EDIT_HISTORY_LIMIT).toBe(50);
    expect(h.past).toHaveLength(50);
    expect(h.past[0].label).toBe('e11');
  });

  it('undo moves to redo; a new edit after an undo clears redo', () => {
    let h = recordEdit(recordEdit(emptyEditHistory(7), entry(1)), entry(2));
    const back = undoStep(h);
    expect(back?.entry.label).toBe('e2');
    h = back!.history;
    expect(h.future).toHaveLength(1);
    const fwd = redoStep(h);
    expect(fwd?.entry.label).toBe('e2');
    h = recordEdit(h, entry(3));
    expect(h.future).toHaveLength(0);
    expect(undoStep(emptyEditHistory(7))).toBeNull();
  });
});

describe('rebaseHistoryPatch — an undo never resurrects a newer sync verdict', () => {
  it('keeps the live syncReport when a sync check rewrote it after the edit', () => {
    const doc = makeDoc();
    const del = applyLevelEdit(doc, { kind: 'delete-room', roomId: 'r2' });
    if (!del.ok) throw new Error(del.error);
    const after = apply(doc, del.data.patch);
    // A Check Sync lands between the edit and the undo.
    const refreshed = { ...after, syncReport: [row('r1')] };
    const rebased = rebaseHistoryPatch(refreshed, del.data.inverse, del.data.patch);
    if (!rebased.ok) throw new Error(rebased.error);
    expect(rebased.data.syncReport).toBeUndefined();
    expect(rebased.data.rooms?.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('restores the syncReport when nothing rewrote it', () => {
    const doc = makeDoc();
    const del = applyLevelEdit(doc, { kind: 'delete-room', roomId: 'r2' });
    if (!del.ok) throw new Error(del.error);
    const rebased = rebaseHistoryPatch(apply(doc, del.data.patch), del.data.inverse, del.data.patch);
    if (!rebased.ok) throw new Error(rebased.error);
    expect(rebased.data.syncReport).toEqual(doc.syncReport);
  });

  it('refuses when the graph itself changed outside the history', () => {
    const doc = makeDoc();
    const del = applyLevelEdit(doc, { kind: 'delete-room', roomId: 'r2' });
    if (!del.ok) throw new Error(del.error);
    const drifted = { ...apply(doc, del.data.patch), rooms: [room('r1', 999), room('r3', 400)] };
    expect(rebaseHistoryPatch(drifted, del.data.inverse, del.data.patch).ok).toBe(false);
  });
});

describe('applyLevelEdit — gate ops (one patch, one inverse, one undo step)', () => {
  it('set-link-gate writes direction + requires + the granting room as ONE {connections, rooms} edit', () => {
    const doc = makeDoc();
    const op: LevelEditOp = {
      kind: 'set-link-gate', connectionId: 'c1',
      change: { direction: 'one-way', requires: ['Brass Key'], grantRoomId: 'r1' },
    };
    const res = applyLevelEdit(doc, op);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { patch, inverse, marksDocAhead } = res.data;
    expect(Object.keys(patch).sort()).toEqual(['connections', 'rooms']);
    expect(patch.connections?.[0]).toMatchObject({ bidirectional: false, requires: ['brass-key'] });
    expect(patch.rooms?.[0].grants).toEqual(['brass-key']);
    expect(inverse.connections).toBe(doc.connections);
    expect(inverse.rooms).toBe(doc.rooms);
    expect(marksDocAhead).toBe(true);
    expect(gestureKey(op, doc)).toBe('gate:c1');
  });

  it('set-link-gate refuses an unknown link and a change that changes nothing', () => {
    expect(applyLevelEdit(makeDoc(), { kind: 'set-link-gate', connectionId: 'zz', change: { direction: 'flip' } }).ok).toBe(false);
    expect(applyLevelEdit(makeDoc(), { kind: 'set-link-gate', connectionId: 'c1', change: { direction: 'two-way' } }).ok).toBe(false);
  });

  it('declare-gate writes requires + grants in one edit and refuses a key behind its own lock', () => {
    const doc = { ...makeDoc(), connections: [{ id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: false, condition: 'Find the bell' }] };
    const res = applyLevelEdit(doc, { kind: 'declare-gate', connectionId: 'c1', key: 'find-the-bell', grantRoomId: 'r1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data.patch).sort()).toEqual(['connections', 'rooms']);
    expect(res.data.patch.connections?.[0].requires).toEqual(['find-the-bell']);
    const behind = applyLevelEdit(doc, { kind: 'declare-gate', connectionId: 'c1', key: 'find-the-bell', grantRoomId: 'r2' });
    expect(behind.ok).toBe(false);
  });
});
