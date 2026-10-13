import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { buildUpdateQuery } from '@/lib/db-utils';

/**
 * buildUpdateQuery backs the PATCH paths of audio scenes, level design and AI testing and had
 * no test of its own. These pin the contract the three callers depend on - run against a real
 * SQLite table so the SQL it emits is executed, not just string-compared.
 */
interface Payload { name?: string; note?: string | null; tags?: string[]; count?: number }
const FIELDS = [
  { key: 'name', column: 'name' },
  { key: 'note', column: 'note' },
  { key: 'tags', column: 'tags_json' },
  { key: 'count', column: 'cnt' },
] satisfies { key: keyof Payload & string; column: string }[];
const JSON_FIELDS = new Set<keyof Payload & string>(['tags']);

function table() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, note TEXT, tags_json TEXT, cnt INTEGER,
           updated_at TEXT NOT NULL DEFAULT '2000-01-01')`);
  db.prepare(`INSERT INTO t (id, name, note, tags_json, cnt) VALUES (1, 'a', 'keep', '[]', 5)`).run();
  return db;
}

describe('buildUpdateQuery', () => {
  it('returns null when nothing is set, so callers can skip the write', () => {
    expect(buildUpdateQuery<Payload>('t', 1, {}, FIELDS, JSON_FIELDS)).toBeNull();
  });

  it('skips undefined fields, writes null as null, and leaves untouched columns alone', () => {
    const db = table();
    const q = buildUpdateQuery<Payload>('t', 1, { name: 'b', note: null }, FIELDS, JSON_FIELDS)!;
    expect(q.sql).toContain('name = ?');
    expect(q.sql).toContain('note = ?');
    expect(q.sql).not.toContain('cnt = ?');
    db.prepare(q.sql).run(...q.values);
    const row = db.prepare('SELECT * FROM t WHERE id = 1').get() as Record<string, unknown>;
    expect(row.name).toBe('b');
    expect(row.note).toBeNull();
    expect(row.cnt).toBe(5);
    expect(row.updated_at).not.toBe('2000-01-01');
  });

  it('writes a falsy-but-defined value (0) rather than treating it as absent', () => {
    const db = table();
    const q = buildUpdateQuery<Payload>('t', 1, { count: 0 }, FIELDS)!;
    db.prepare(q.sql).run(...q.values);
    expect((db.prepare('SELECT cnt FROM t WHERE id = 1').get() as { cnt: number }).cnt).toBe(0);
  });

  it('JSON-stringifies only the declared json fields and binds the id last', () => {
    const db = table();
    const q = buildUpdateQuery<Payload>('t', 1, { tags: ['x', 'y'], name: 'n' }, FIELDS, JSON_FIELDS)!;
    expect(q.values).toEqual(['n', '["x","y"]', 1]);
    db.prepare(q.sql).run(...q.values);
    expect((db.prepare('SELECT tags_json FROM t WHERE id = 1').get() as { tags_json: string }).tags_json).toBe('["x","y"]');
  });

  it('touches only the addressed row', () => {
    const db = table();
    db.prepare(`INSERT INTO t (id, name) VALUES (2, 'other')`).run();
    const q = buildUpdateQuery<Payload>('t', 1, { name: 'changed' }, FIELDS)!;
    db.prepare(q.sql).run(...q.values);
    expect((db.prepare('SELECT name FROM t WHERE id = 2').get() as { name: string }).name).toBe('other');
  });
});
