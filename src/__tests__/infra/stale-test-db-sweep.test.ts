import { describe, it, expect } from 'vitest';
import { selectStaleTestDbs, STALE_TEST_DB_MIN_AGE_MS } from '../../../vitest.global-setup';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const OLD = NOW - STALE_TEST_DB_MIN_AGE_MS - 60_000;
const FRESH = NOW - STALE_TEST_DB_MIN_AGE_MS + 60_000;
const OWN_PID = 4242;

const pick = (entries: Array<{ name: string; mtimeMs: number }>) => selectStaleTestDbs(entries, NOW, OWN_PID);

describe('selectStaleTestDbs', () => {
  it('selects an old pof-test DB and its wal/shm sidecars', () => {
    const names = ['pof-test-verdict-binding-1234.db', 'pof-test-verdict-binding-1234.db-wal', 'pof-test-verdict-binding-1234.db-shm'];
    expect(pick(names.map((name) => ({ name, mtimeMs: OLD })))).toEqual(names);
  });

  it('keeps a fresh matching file (a concurrent run in another worktree)', () => {
    expect(pick([{ name: 'pof-test-catalog-transition-999.db', mtimeMs: FRESH }])).toEqual([]);
  });

  it('keeps a file exactly at the age floor', () => {
    expect(pick([{ name: 'pof-test-a-1.db', mtimeMs: NOW - STALE_TEST_DB_MIN_AGE_MS }])).toEqual([]);
  });

  it('never selects a non-matching name, however old', () => {
    const names = ['pof.db', 'pof.db-wal', 'pof-vitest', 'pof-test-notes.txt', 'xpof-test-a-1.db', 'pof-test-a-1.db.bak', 'other.db'];
    expect(pick(names.map((name) => ({ name, mtimeMs: OLD })))).toEqual([]);
  });

  it("never selects this run's own floor DB or its per-worker DBs", () => {
    const names = [`pof-test-${OWN_PID}.db`, `pof-test-${OWN_PID}.db-wal`, `pof-test-${OWN_PID}-w3.db`, `pof-test-${OWN_PID}-w3.db-shm`];
    expect(pick(names.map((name) => ({ name, mtimeMs: OLD })))).toEqual([]);
  });

  it('never selects a path outside the temp dir', () => {
    const names = ['../pof-test-a-1.db', 'sub/pof-test-a-1.db', '..\\pof-test-a-1.db', '/home/u/.pof/pof-test-a-1.db'];
    expect(pick(names.map((name) => ({ name, mtimeMs: OLD })))).toEqual([]);
  });

  it('picks only the old ones from a mixed listing', () => {
    expect(
      pick([
        { name: 'pof-test-a-1.db', mtimeMs: OLD },
        { name: 'pof-test-b-2.db', mtimeMs: FRESH },
        { name: 'pof.db', mtimeMs: OLD },
      ]),
    ).toEqual(['pof-test-a-1.db']);
  });
});
