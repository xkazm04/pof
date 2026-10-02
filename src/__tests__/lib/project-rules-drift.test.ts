/**
 * Canon drift on the DB side: each project_rules row records the hash of the shipped text it was
 * last written from (`shipped_hash`). A row still equal to that offer FOLLOWS a later correction on
 * its own; an operator's edit keeps its text; a legacy row (no recorded offer) is only ever REPORTED.
 * Throwaway DBs via `POF_DB_PATH`; the user's `~/.pof/pof.db` is never opened.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';

function newDbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-canon-drift-${process.pid}-${tag}.db`);
  for (const s of ['', '-wal', '-shm']) if (fs.existsSync(file + s)) fs.rmSync(file + s);
  return file;
}

const rule = (id: string, body: string) => ({ id, category: 'game' as const, scope: 'global', title: id, body, refs: [], profile: 'diablo1' });

async function loadWithSeed(file: string, seed?: ReturnType<typeof rule>[]) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  if (seed) vi.doMock('@/lib/catalog/canon/profiles/diablo1', () => ({ DIABLO1_CANON: seed, DIABLO1_INHERITS_POF: [] }));
  const rules = await import('@/lib/project-rules-db');
  const db = await import('@/lib/db');
  return { rules, db };
}

afterEach(() => { vi.doUnmock('@/lib/catalog/canon/profiles/diablo1'); });

describe('auto-follow is limited to rows provably untouched since their recorded offer', () => {
  it('a corrected shipped law reaches an untouched row; an operator-edited row keeps its text', async () => {
    const file = newDbFile('follow');
    const first = await loadWithSeed(file, [rule('d1-a', 'v1'), rule('d1-b', 'v1')]);
    expect(first.rules.listRules().find((r) => r.id === 'd1-a')?.body).toBe('v1');
    first.rules.upsertRule({ ...rule('d1-b', 'v1'), body: 'operator text' });
    first.db.getDb().close();

    const second = await loadWithSeed(file, [rule('d1-a', 'v2'), rule('d1-b', 'v1')]);
    const all = second.rules.listRules();
    expect(all.find((r) => r.id === 'd1-a')?.body).toBe('v2');
    expect(all.find((r) => r.id === 'd1-b')?.body).toBe('operator text');
    second.db.getDb().close();
  });
});

describe('a DB shaped like the real one (seeded before provenance, 3 stale laws)', () => {
  it('reports 3 unrecorded findings with both texts and writes nothing until an adopt', async () => {
    const file = newDbFile('legacy');
    const first = await loadWithSeed(file);
    first.rules.listRules();
    const stale = DIABLO1_CANON.slice(0, 3).map((r) => r.id);
    const raw = first.db.getDb();
    for (const id of stale) raw.prepare("UPDATE project_rules SET body = ?, updated_at = '2026-09-26 14:48:57' WHERE id = ?").run(`older shipped text of ${id}`, id);
    // The real DB predates the column entirely.
    raw.exec('ALTER TABLE project_rules DROP COLUMN shipped_hash');
    const before = first.rules.listRules();
    raw.close();

    const second = await loadWithSeed(file);
    const drift = second.rules.canonDrift();
    const unrecorded = drift.byProfile.diablo1?.unrecorded ?? [];
    expect(unrecorded.map((f) => f.id).sort()).toEqual([...stale].sort());
    expect(drift.total).toBe(3);
    const f = unrecorded.find((x) => x.id === stale[0])!;
    expect(f).toMatchObject({
      id: stale[0], profile: 'diablo1',
      dbBody: `older shipped text of ${stale[0]}`,
      shippedBody: DIABLO1_CANON[0].body,
    });
    // Nothing auto-written: the prompts still read exactly what they read before.
    expect(second.rules.listRules()).toEqual(before);
    second.db.getDb().close();
  });
});
