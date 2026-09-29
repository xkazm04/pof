/**
 * gate-authoring — locks, keys and one-way doors as data the editor can write.
 *
 * The level model has always carried `RoomConnection.requires`, `RoomNode.grants`,
 * `bidirectional` and the prose `condition`, and the pacing linter proves a
 * gate-and-key closure over them. These helpers are the writers: every one
 * returns ONE patch (or a reason), and the grant-room picker is fed by the
 * linter's own closure run with the gate in question held shut.
 */
import { describe, it, expect } from 'vitest';
import {
  normaliseKeyIds,
  setLinkGate,
  setLinkDirection,
  declareGateFromCondition,
  applyGateDeclaration,
  applyLinkChange,
  keyLedger,
} from '@/lib/level-design/gate-authoring';
import { lintLevelPacing } from '@/lib/level-design/pacing-linter';
import type { LevelDesignDocument, RoomConnection, RoomNode } from '@/types/level-design';
import type { LevelDocPatch } from '@/lib/level-design/level-edit';

const room = (id: string, name: string, over: Partial<RoomNode> = {}): RoomNode => ({
  id, name, type: 'exploration', description: '', encounterDesign: '', difficulty: 2,
  pacing: 'rest', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [], ...over,
});

const conn = (id: string, fromId: string, toId: string, over: Partial<RoomConnection> = {}): RoomConnection => ({
  id, fromId, toId, bidirectional: true, condition: '', ...over,
});

function doc(rooms: RoomNode[], connections: RoomConnection[], arc: string[] = []): LevelDesignDocument {
  return {
    id: 1, name: 'Crypt', description: '', designNarrative: '', rooms, connections,
    difficultyArc: arc, pacingNotes: '', syncStatus: 'synced', syncReport: [],
    lastGeneratedAt: null, lastCodeHash: null, createdAt: '', updatedAt: '',
  };
}

const apply = (d: LevelDesignDocument, patch: LevelDocPatch): LevelDesignDocument => ({ ...d, ...patch });

/** a <-> b open; c2 = b -> c gated by prose only. */
function proseGateDoc(): LevelDesignDocument {
  return doc(
    [room('a', 'Atrium'), room('b', 'Bone Hall'), room('c', 'Crypt Vault')],
    [conn('c1', 'a', 'b'), conn('c2', 'b', 'c', { bidirectional: false, condition: 'Collect the brass key' })],
    ['a', 'b', 'c'],
  );
}

function threeLinkDoc(): LevelDesignDocument {
  return doc(
    [room('r1', 'Room r1'), room('r2', 'Room r2'), room('r3', 'Room r3')],
    [conn('c0', 'r2', 'r3'), conn('c1', 'r1', 'r2'), conn('c9', 'r1', 'r3')],
    ['r1', 'r2', 'r3'],
  );
}

describe('case 1 — setLinkGate normalises keys and touches one connection', () => {
  it('trims, slugs, dedupes and drops empties; patch is exactly {connections}; others reference-equal', () => {
    const d = threeLinkDoc();
    const res = setLinkGate(d, 'c1', { requires: [' Brass Key ', 'brass-key', ''] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data)).toEqual(['connections']);
    const next = res.data.connections!;
    expect(next.find((c) => c.id === 'c1')?.requires).toEqual(['brass-key']);
    expect(next[0]).toBe(d.connections[0]);
    expect(next[2]).toBe(d.connections[2]);
    expect(normaliseKeyIds(['  Guardian  Defeated! ', 'guardian-defeated'])).toEqual(['guardian-defeated']);
  });

  it('an emptied requirement removes the gate (no empty array left behind)', () => {
    const d = doc([room('a', 'A'), room('b', 'B')], [conn('c1', 'a', 'b', { requires: ['k'] })]);
    const res = setLinkGate(d, 'c1', { requires: ['  '] });
    expect(res.ok && 'requires' in res.data.connections![0]).toBe(false);
  });
});

describe('case 2 — setLinkDirection', () => {
  it('one-way clears bidirectional; flip swaps ends and keeps the id; unknown id is refused', () => {
    const d = threeLinkDoc();
    const oneWay = setLinkDirection(d, 'c1', 'one-way');
    expect(oneWay.ok && oneWay.data.connections!.find((c) => c.id === 'c1')?.bidirectional).toBe(false);
    const flipped = setLinkDirection(d, 'c1', 'flip');
    expect(flipped.ok).toBe(true);
    if (flipped.ok) {
      expect(flipped.data.connections!.find((c) => c.id === 'c1')).toMatchObject({ id: 'c1', fromId: 'r2', toId: 'r1' });
    }
    const unknown = setLinkDirection(d, 'nope', 'flip');
    expect(unknown.ok).toBe(false);
    expect('data' in unknown).toBe(false);
  });
});

describe('case 3 — declareGateFromCondition', () => {
  it('slugs the prose into a key and offers the rooms reachable with THIS gate shut', () => {
    const res = declareGateFromCondition(proseGateDoc(), 'c2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.key).toBe('collect-the-brass-key');
    expect(res.data.grantCandidates).toEqual(['a', 'b']);
  });

  it('refuses a link with no prose condition, or one already declared', () => {
    expect(declareGateFromCondition(proseGateDoc(), 'c1').ok).toBe(false);
    const gated = setLinkGate(proseGateDoc(), 'c2', { requires: ['k'] });
    if (!gated.ok) throw new Error(gated.error);
    expect(declareGateFromCondition(apply(proseGateDoc(), gated.data), 'c2').ok).toBe(false);
  });
});

describe('case 4 — applyGateDeclaration closes the proof', () => {
  it('ONE {connections, rooms} patch flips the undeclared gate to a proven, ordered gate', () => {
    const d = proseGateDoc();
    const before = lintLevelPacing(d);
    expect(before.findings.filter((f) => f.ruleId === 'undeclared-gate')).toHaveLength(1);
    expect(before.reachability.proven).toBe(false);

    const res = applyGateDeclaration(d, 'c2', 'collect-the-brass-key', 'b');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data).sort()).toEqual(['connections', 'rooms']);
    const after = lintLevelPacing(apply(d, res.data));
    expect(after.findings.some((f) => f.ruleId === 'undeclared-gate')).toBe(false);
    expect(after.reachability.proven).toBe(true);
    expect(after.reachability.gatesTotal).toBe(1);
    expect(after.reachability.levels).toHaveLength(2);
    expect(after.reachability.levels[0].roomsReached).toBe(2);
    expect(after.reachability.levels[1].roomsReached).toBe(3);
  });
});

describe('case 5 — a key behind its own lock is refused', () => {
  it('granting from c (reachable only through c2) errs naming c, with no patch', () => {
    const res = applyGateDeclaration(proseGateDoc(), 'c2', 'collect-the-brass-key', 'c');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Crypt Vault/);
    expect(res.error).toMatch(/only through this gate/);
  });
});

describe('case 6 — keyLedger', () => {
  it('lists granters and requirers per key, plus orphans both ways', () => {
    const d = doc(
      [room('a', 'A', { grants: ['brass-key', 'spare-key'] }), room('b', 'B'), room('c', 'C')],
      [conn('c1', 'a', 'b', { requires: ['brass-key'] }), conn('c2', 'b', 'c', { requires: ['ghost-key'] })],
    );
    const ledger = keyLedger(d);
    expect(ledger.keys['brass-key']).toEqual({ grantedBy: ['a'], requiredBy: ['c1'] });
    expect(ledger.keys['ghost-key']).toEqual({ grantedBy: [], requiredBy: ['c2'] });
    expect(ledger.orphanRequires).toEqual(['ghost-key']);
    expect(ledger.unusedGrants).toEqual(['spare-key']);
  });
});

describe('applyLinkChange — the inspector Apply', () => {
  it('direction + requires + grant land as ONE patch, and a no-op change is empty', () => {
    const d = threeLinkDoc();
    const res = applyLinkChange(d, 'c1', { direction: 'one-way', requires: ['brass-key'], grantRoomId: 'r1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.data).sort()).toEqual(['connections', 'rooms']);
    expect(res.data.connections!.find((c) => c.id === 'c1')).toMatchObject({ bidirectional: false, requires: ['brass-key'] });
    expect(res.data.rooms!.find((r) => r.id === 'r1')?.grants).toEqual(['brass-key']);
    const noop = applyLinkChange(d, 'c1', { direction: 'two-way', condition: '' });
    expect(noop.ok && Object.keys(noop.data)).toEqual([]);
  });
});
