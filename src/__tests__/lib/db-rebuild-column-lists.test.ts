// @vitest-environment node
/**
 * The table-rebuild migrations in db.ts copy rows by a HAND-MAINTAINED column list
 * (an explicit list, because a positional `SELECT *` copy once shifted every value).
 * A list is only safe while it names every column the live table holds: a column added
 * to the bootstrap CREATE (plus its ALTER) but not to the list is silently dropped by
 * the next rebuild that runs on an older DB. This derives the truth from the schema
 * the bootstrap actually creates, not from the list itself.
 *
 * Runs against the worker's containment DB (POF_DB_PATH), never ~/.pof/pof.db.
 */
import { describe, it, expect } from 'vitest';
import { FEATURE_MATRIX_COLUMN_LIST, SESSION_ANALYTICS_COLUMN_LIST, getDb } from '@/lib/db';

function liveColumns(table: string): string[] {
  return (getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

describe('db.ts rebuild column lists cover the live schema', () => {
  it.each([
    ['feature_matrix', FEATURE_MATRIX_COLUMN_LIST],
    ['session_analytics', SESSION_ANALYTICS_COLUMN_LIST],
  ] as const)('%s: the copy list names every column, in declared order', (table, list) => {
    expect([...list]).toEqual(liveColumns(table));
  });
});
