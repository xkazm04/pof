/**
 * The level-design summary has two implementations that must agree.
 *
 * `deriveSummary` (src/hooks/useDesignDocument.ts) is the client twin of the server's
 * `getSummary()` (src/lib/level-design-db.ts): the sidebar counters are derived from
 * the doc list so an optimistic mutation updates them without a round trip. The twin
 * declares "same rules, same fields", and nothing pinned it — either side could
 * change a bucket rule (which syncStatus counts as diverged, which difficulty is in
 * range) and the sidebar would silently disagree with the server.
 *
 * This feeds ONE table through both paths and requires identical output.
 */
import { describe, it, expect, vi } from 'vitest';
import type { LevelDesignDocument } from '@/types/level-design';

interface Row { [k: string]: unknown }
let docRows: Row[] = [];

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    exec: () => {},
    prepare: (sql: string) => ({
      all: () => (sql.includes('SELECT rooms')
        ? docRows.map((r) => ({ rooms: r.rooms, sync_status: r.sync_status, last_code_hash: r.last_code_hash }))
        : docRows),
      get: () => docRows[0],
      run: () => ({ changes: 1, lastInsertRowid: 1 }),
    }),
  }),
}));

const { getAllDocs, getSummary } = await import('@/lib/level-design-db');
const { deriveSummary } = await import('@/hooks/useDesignDocument');

function room(id: string, type: string, difficulty: number) {
  return { id, name: id, type, difficulty, pacing: 'rising', x: 0, y: 0, description: '', encounterDesign: '', linkedFiles: [], spawnEntries: [], tags: [] };
}

function row(id: number, sync: string, rooms: unknown): Row {
  return {
    id, name: `L${id}`, description: '', design_narrative: '',
    rooms: typeof rooms === 'string' ? rooms : JSON.stringify(rooms),
    connections: '[]', difficulty_arc: '[]', pacing_notes: '', sync_status: sync, sync_report: '[]',
    last_generated_at: null, last_code_hash: null,
    created_at: '2026-11-08 00:00:00', updated_at: '2026-11-08 00:00:00',
  };
}

const TYPES = ['combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub'];

/** Every sync bucket, every room type, every difficulty, plus the out-of-range,
 *  unknown-type and damaged-blob edges each side guards. */
const TABLE: Row[] = [
  { ...row(1, 'synced', TYPES.map((t, i) => room(`a${i}`, t, (i % 5) + 1))), last_code_hash: 'h1' },
  row(2, 'diverged', [room('b1', 'boss', 5), room('b2', 'boss', 0)]),
  row(3, 'doc-ahead', [room('c1', 'hub', 6)]),
  row(4, 'code-ahead', [room('d1', 'not-a-type', 2)]),
  row(5, 'unlinked', []),
  row(6, 'unlinked', 'not json at all'),
  row(7, 'something-new', [room('e1', 'safe', 1)]),
  // synced but never compared (codegen stamps it): not counted as synced on either side
  row(8, 'synced', []),
];

describe('deriveSummary ↔ getSummary parity', () => {
  it('the client twin and the server summary agree on the same table', () => {
    docRows = TABLE;
    const server = getSummary();
    const client = deriveSummary(getAllDocs() as LevelDesignDocument[]);
    expect(client).toEqual(server);
    // Sanity: the fixture actually exercises every bucket it claims to.
    expect(server.syncedCount).toBe(1);
    expect(server.divergedCount).toBe(3);
    expect(server.unlinkedCount).toBe(2);
    expect(server.totalDocs).toBe(8);
  });

  it('[control] the comparison notices a drifted input', () => {
    docRows = TABLE;
    const server = getSummary();
    const client = deriveSummary((getAllDocs() as LevelDesignDocument[]).slice(1));
    expect(client).not.toEqual(server);
  });
});
