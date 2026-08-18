/**
 * One damaged row must not cost the user every level design.
 *
 * `rooms` / `connections` / `difficulty_arc` / `sync_report` are free-form TEXT
 * columns. A truncated write or a hand-edited row is enough to make `JSON.parse`
 * throw, and thrown from inside `rows.map(rowToDoc)` that single bad row used to
 * 500 the whole `GET /api/level-design` — the entire list became unreachable.
 * A bad row now degrades to a loudly NAMED broken document instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row { [k: string]: unknown }

let docRows: Row[] = [];

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    exec: () => {},
    prepare: (sql: string) => ({
      all: () => (sql.includes('SELECT rooms')
        ? docRows.map((r) => ({ rooms: r.rooms, sync_status: r.sync_status }))
        : docRows),
      get: () => docRows[0],
      run: () => ({ changes: 1, lastInsertRowid: 1 }),
    }),
  }),
}));

const { rowToDoc, getAllDocs, getSummary, BROKEN_DOC_MARKER, brokenDocName } =
  await import('@/lib/level-design-db');

function row(over: Row = {}): Row {
  return {
    id: 1,
    name: 'Sunken Crypt',
    description: 'desc',
    design_narrative: 'narrative',
    rooms: '[]',
    connections: '[]',
    difficulty_arc: '[]',
    pacing_notes: 'notes',
    sync_status: 'unlinked',
    sync_report: '[]',
    last_generated_at: null,
    last_code_hash: null,
    created_at: '2026-08-18 10:00:00',
    updated_at: '2026-08-18 10:00:00',
    ...over,
  };
}

const ONE_ROOM = JSON.stringify([{ id: 'r1', name: 'Hall', type: 'combat', difficulty: 3, pacing: 'rising', x: 0, y: 0, description: '', encounterDesign: '', linkedFiles: [], spawnEntries: [], tags: [] }]);

beforeEach(() => { docRows = []; });

describe('rowToDoc', () => {
  it('degrades a malformed rooms blob to a named broken doc instead of throwing', () => {
    const doc = rowToDoc(row({ id: 4, rooms: '[{"id":"r1",' }));

    expect(doc.name).toBe(brokenDocName('Sunken Crypt', ['rooms']));
    expect(doc.name).toContain(BROKEN_DOC_MARKER);
    expect(doc.rooms).toEqual([]);
    // Everything that WAS readable survives — the row is degraded, not discarded.
    expect(doc.id).toBe(4);
    expect(doc.designNarrative).toBe('narrative');
    expect(doc.pacingNotes).toBe('notes');
  });

  it('names every unreadable column, and flags valid JSON of the wrong shape', () => {
    const doc = rowToDoc(row({ rooms: '{"not":"an array"}', connections: 'nope' }));
    expect(doc.name).toBe(brokenDocName('Sunken Crypt', ['rooms', 'connections']));
    expect(doc.rooms).toEqual([]);
    expect(doc.connections).toEqual([]);
  });

  it('leaves a healthy row completely untouched', () => {
    const doc = rowToDoc(row({ rooms: ONE_ROOM }));
    expect(doc.name).toBe('Sunken Crypt');
    expect(doc.name).not.toContain(BROKEN_DOC_MARKER);
    expect(doc.rooms).toHaveLength(1);
  });
});

describe('getAllDocs', () => {
  it('still loads the rest of the list when one row is unreadable', () => {
    docRows = [
      row({ id: 1, name: 'Alpha', rooms: ONE_ROOM }),
      row({ id: 2, name: 'Broken', rooms: '[{"id":' }),
      row({ id: 3, name: 'Omega', rooms: ONE_ROOM }),
    ];

    const docs = getAllDocs();

    expect(docs).toHaveLength(3);
    expect(docs.map((d) => d.id)).toEqual([1, 2, 3]);
    expect(docs[0].name).toBe('Alpha');
    expect(docs[0].rooms).toHaveLength(1);
    expect(docs[1].name).toBe(brokenDocName('Broken', ['rooms']));
    expect(docs[2].name).toBe('Omega');
    expect(docs[2].rooms).toHaveLength(1);
  });
});

describe('getSummary', () => {
  it('counts the healthy rows instead of throwing on the damaged one', () => {
    docRows = [
      row({ id: 1, rooms: ONE_ROOM, sync_status: 'synced' }),
      row({ id: 2, rooms: 'not json at all', sync_status: 'unlinked' }),
    ];

    const summary = getSummary();

    expect(summary.totalDocs).toBe(2);
    expect(summary.totalRooms).toBe(1);
    expect(summary.syncedCount).toBe(1);
    expect(summary.unlinkedCount).toBe(1);
    expect(summary.difficultyDistribution[3]).toBe(1);
    expect(summary.roomTypeDistribution.combat).toBe(1);
  });
});
