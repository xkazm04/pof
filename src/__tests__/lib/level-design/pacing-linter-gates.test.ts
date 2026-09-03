import { describe, it, expect } from 'vitest';
import {
  lintLevelPacing,
  RULE_LABELS,
  type PacingFinding,
  type PacingRuleId,
} from '@/lib/level-design/pacing-linter';
import type {
  LevelDesignDocument,
  RoomConnection,
  RoomNode,
} from '@/types/level-design';

// ── Fixtures ────────────────────────────────────────────────────────────────
// Shaped like a real stored document (see src/lib/level-design-db.ts rowToDoc
// and the LevelFlowEditor addRoom/addConnection handlers): every RoomNode field
// is populated, connections carry the `condition` string the editor writes as ''.

function room(id: string, name: string, over: Partial<RoomNode> = {}): RoomNode {
  return {
    id,
    name,
    type: 'exploration',
    description: `The ${name}, cut from damp crypt stone.`,
    encounterDesign: 'Ambient dread; no scripted encounter.',
    difficulty: 2,
    pacing: 'rest',
    x: 0,
    y: 0,
    linkedFiles: [],
    spawnEntries: [],
    tags: ['crypt'],
    ...over,
  };
}

function conn(
  id: string,
  fromId: string,
  toId: string,
  over: Partial<RoomConnection> = {},
): RoomConnection {
  return { id, fromId, toId, bidirectional: false, condition: '', ...over };
}

function doc(
  rooms: RoomNode[],
  connections: RoomConnection[],
  over: Partial<LevelDesignDocument> = {},
): LevelDesignDocument {
  return {
    id: 1,
    name: 'Crypt of the First King',
    description: 'The opening dungeon.',
    designNarrative: 'A descent from the chapel into the flooded royal crypt.',
    rooms,
    connections,
    difficultyArc: rooms.map((r) => r.id),
    pacingNotes: 'Slow burn into the vault.',
    syncStatus: 'unlinked',
    syncReport: [],
    lastGeneratedAt: null,
    lastCodeHash: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const ids = (fs: PacingFinding[], rule: PacingRuleId) =>
  fs.filter((f) => f.ruleId === rule);

// ── The defect: a locked door walked as an open one ──────────────────────────

describe('pacing linter — gate-and-key solvability closure', () => {
  it('does NOT report a room behind a gate whose key sits behind that same gate as reachable', () => {
    // A -> B -> (needs brass-key) -> Vault, and the brass key is IN the vault.
    const d = doc(
      [
        room('a', 'Chapel Stair'),
        room('b', 'Ossuary'),
        room('c', 'Sealed Vault', { grants: ['brass-key'] }),
      ],
      [
        conn('c1', 'a', 'b'),
        conn('c2', 'b', 'c', {
          condition: 'collect the brass key',
          requires: ['brass-key'],
        }),
      ],
    );

    const { findings, reachability } = lintLevelPacing(d);

    // The vault is NOT reachable — the closure must not walk the lock.
    expect(reachability.roomsReached).toBe(2);
    expect(reachability.roomsTotal).toBe(3);

    // ...and it is reported as gated, not as structurally disconnected.
    const gated = ids(findings, 'gated-unreachable');
    expect(gated.map((f) => f.roomIds[0])).toEqual(['c']);
    expect(gated[0].severity).toBe('critical');
    expect(ids(findings, 'unreachable-room')).toHaveLength(0);

    // ...and the inversion itself is named: key, gate, gate level, key level.
    const unwinnable = ids(findings, 'unwinnable-gate');
    expect(unwinnable).toHaveLength(1);
    expect(unwinnable[0].severity).toBe('critical');
    expect(unwinnable[0].message).toContain('brass-key');
    expect(unwinnable[0].message).toContain('Sealed Vault');
  });

  it('accepts the same level once the key is moved in front of its gate', () => {
    const d = doc(
      [
        room('a', 'Chapel Stair', { grants: ['brass-key'] }),
        room('b', 'Ossuary'),
        room('c', 'Sealed Vault'),
      ],
      [
        conn('c1', 'a', 'b'),
        conn('c2', 'b', 'c', {
          condition: 'collect the brass key',
          requires: ['brass-key'],
        }),
      ],
    );

    const { findings, reachability } = lintLevelPacing(d);

    expect(reachability.roomsReached).toBe(3);
    expect(reachability.proven).toBe(true);
    expect(ids(findings, 'gated-unreachable')).toHaveLength(0);
    expect(ids(findings, 'unwinnable-gate')).toHaveLength(0);
    expect(ids(findings, 'gate-deadlock')).toHaveLength(0);
    // The closure is emitted as data: two levels — free set, then post-key set.
    expect(reachability.levels.map((l) => l.roomsReached)).toEqual([2, 3]);
  });

  it('reports a two-gate cycle as ONE residual finding, never a guessed guilty gate', () => {
    // North key is behind the south gate; south key is behind the north gate.
    const d = doc(
      [
        room('hub', 'Flooded Hub'),
        room('n', 'North Wing', { grants: ['south-key'] }),
        room('s', 'South Wing', { grants: ['north-key'] }),
      ],
      [
        conn('g-n', 'hub', 'n', { condition: 'needs north key', requires: ['north-key'] }),
        conn('g-s', 'hub', 's', { condition: 'needs south key', requires: ['south-key'] }),
      ],
    );

    const { findings } = lintLevelPacing(d);

    const deadlock = ids(findings, 'gate-deadlock');
    expect(deadlock).toHaveLength(1);
    // Neither key is behind its OWN gate — a per-gate predicate passes both.
    expect(ids(findings, 'unwinnable-gate')).toHaveLength(0);
    // The whole residual set is named.
    expect(deadlock[0].message).toContain('North Wing');
    expect(deadlock[0].message).toContain('South Wing');
    expect(deadlock[0].roomIds).toEqual(expect.arrayContaining(['n', 's']));
  });

  it('grades a deadlock by whether the objective survives it', () => {
    // Objective reachable, the cycle only strands optional wings → warning.
    const optional = doc(
      [
        room('hub', 'Flooded Hub'),
        room('boss', 'Throne of the First King', { type: 'boss' }),
        room('n', 'North Wing', { grants: ['south-key'] }),
        room('s', 'South Wing', { grants: ['north-key'] }),
      ],
      [
        conn('c-boss', 'hub', 'boss'),
        conn('g-n', 'hub', 'n', { requires: ['north-key'] }),
        conn('g-s', 'hub', 's', { requires: ['south-key'] }),
      ],
    );
    expect(ids(lintLevelPacing(optional).findings, 'gate-deadlock')[0].severity).toBe('warning');

    // Objective stranded behind the cycle → hard failure.
    const stranded = doc(
      [
        room('hub', 'Flooded Hub'),
        room('n', 'North Wing', { grants: ['south-key'] }),
        room('s', 'Throne of the First King', { type: 'boss', grants: ['north-key'] }),
      ],
      [
        conn('g-n', 'hub', 'n', { requires: ['north-key'] }),
        conn('g-s', 'hub', 's', { requires: ['south-key'] }),
      ],
    );
    expect(ids(lintLevelPacing(stranded).findings, 'gate-deadlock')[0].severity).toBe('critical');

    // No objective declared: we cannot claim it survives, so we do not soften.
    const noObjective = doc(
      [
        room('hub', 'Flooded Hub'),
        room('n', 'North Wing', { grants: ['south-key'] }),
        room('s', 'South Wing', { grants: ['north-key'] }),
      ],
      [
        conn('g-n', 'hub', 'n', { requires: ['north-key'] }),
        conn('g-s', 'hub', 's', { requires: ['south-key'] }),
      ],
    );
    const f = ids(lintLevelPacing(noObjective).findings, 'gate-deadlock')[0];
    expect(f.severity).toBe('critical');
    expect(f.message).toContain('No boss room is declared');
  });

  it('reports a gate whose key no room grants at all', () => {
    const d = doc(
      [room('a', 'Chapel Stair'), room('b', 'Sealed Vault')],
      [conn('c1', 'a', 'b', { condition: 'needs the sunstone', requires: ['sunstone'] })],
    );

    const { findings } = lintLevelPacing(d);
    const unwinnable = ids(findings, 'unwinnable-gate');
    expect(unwinnable).toHaveLength(1);
    expect(unwinnable[0].message).toContain('sunstone');
    expect(ids(findings, 'gate-deadlock')).toHaveLength(0);
  });

  // ── L13: declaring an input is not consuming it ───────────────────────────

  it('reports free-text condition with no structured gate as an undeclared gate', () => {
    const d = doc(
      [room('a', 'Chapel Stair'), room('b', 'Ossuary'), room('c', 'Sealed Vault')],
      [conn('c1', 'a', 'b'), conn('c2', 'b', 'c', { condition: 'defeat the guardian' })],
    );

    const { findings, reachability } = lintLevelPacing(d);

    const undeclared = ids(findings, 'undeclared-gate');
    expect(undeclared).toHaveLength(1);
    expect(undeclared[0].severity).toBe('warning');
    expect(undeclared[0].message).toContain('defeat the guardian');
    expect(reachability.undeclaredGates).toEqual(['c2']);

    // Prose is not evidence of a lock: we do NOT invent unreachability...
    expect(ids(findings, 'gated-unreachable')).toHaveLength(0);
    expect(ids(findings, 'unreachable-room')).toHaveLength(0);
    // ...but the closure is no longer a proof.
    expect(reachability.proven).toBe(false);
  });

  // ── L12: an instrument proves it had input before it reports a verdict ─────

  it('reports a document with no rooms as NOT MEASURED rather than clean', () => {
    const { findings, reachability } = lintLevelPacing(doc([], []));
    expect(findings).toEqual([]);
    expect(reachability.measured).toBe(false);
    expect(reachability.proven).toBe(false);
    expect(reachability.roomsTotal).toBe(0);
  });

  it('carries the size of what it walked', () => {
    const d = doc(
      [room('a', 'Chapel Stair'), room('b', 'Ossuary'), room('c', 'Crypt Landing')],
      [conn('c1', 'a', 'b'), conn('c2', 'b', 'c')],
    );
    const { reachability } = lintLevelPacing(d);
    expect(reachability.measured).toBe(true);
    expect(reachability.roomsTotal).toBe(3);
    expect(reachability.roomsReached).toBe(3);
    expect(reachability.seeds).toEqual(['a']);
  });

  // ── Backward compatibility ────────────────────────────────────────────────

  it('behaves identically to plain reachability on an ungated document', () => {
    // A detached pair (both ends have an incoming edge, so neither seeds the
    // walk) is what the ungated rule has always reported as unreachable.
    const d = doc(
      [
        room('a', 'Chapel Stair'),
        room('b', 'Ossuary'),
        room('x', 'Forgotten Cell'),
        room('y', 'Collapsed Shaft'),
      ],
      [conn('c1', 'a', 'b'), conn('c2', 'x', 'y', { bidirectional: true })],
    );

    const { findings, reachability } = lintLevelPacing(d);

    expect(ids(findings, 'unreachable-room').map((f) => f.roomIds[0])).toEqual(['x', 'y']);
    expect(ids(findings, 'gated-unreachable')).toHaveLength(0);
    expect(ids(findings, 'undeclared-gate')).toHaveLength(0);
    expect(reachability.gatesTotal).toBe(0);
    expect(reachability.proven).toBe(true);
  });

  it('registers every new rule in RULE_LABELS so the report filter can name it', () => {
    for (const rule of [
      'gated-unreachable',
      'unwinnable-gate',
      'gate-deadlock',
      'undeclared-gate',
    ] as PacingRuleId[]) {
      expect(RULE_LABELS[rule]).toBeTruthy();
    }
  });
});
