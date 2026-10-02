/**
 * The stored content hash — `pipeline_artifacts.content_hash` as a READ MODEL of `data`.
 *
 * Whole-project verdict readers (/status, the lab coach's summary fan-out, the changes digest)
 * need a row's verdict and its content binding, never its blob. The hash is therefore stamped
 * once, at the one write door (`upsertArtifact`), and read back by `listArtifactVerdicts`
 * without the blob. A stored read model carries three obligations and each is pinned here:
 *  - recomputation: an old-DDL DB is backfilled in place; a foreign-scheme hash is re-derived;
 *  - propagation: the door restamps on every write, and a writer that BYPASSES the door (an
 *    older checkout on the shared DB) cannot leave a stale hash behind (the invalidation trigger);
 *  - the drain shape: re-upserting IDENTICAL data with a new verdict keeps the stored hash, so
 *    drained rows never fall back to the blob read this exists to remove.
 */
import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-artifact-content-hash-${process.pid}-${Date.now()}.db`;
});
import { getDb } from '@/lib/db';
import { upsertArtifact, listArtifacts, listArtifactVerdicts, type PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from '@/lib/judge/contentHash';

const CAT = 'h';
const D = { brief: 'first body', stats: { Damage: 34 } };
const D2 = { brief: 'second body', stats: { Damage: 40 } };

const put = (entityId: string, step: string, data: Record<string, unknown>, extra: Partial<PipelineArtifact> = {}) =>
  upsertArtifact({ catalogId: CAT, entityId, step, data, ueAssets: ['/Game/B', '/Game/A'], status: 'pass', tier: 'L0', ...extra });

const storedHash = (entityId: string, step: string, catalogId = CAT) =>
  (getDb().prepare('SELECT content_hash FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ? AND step = ?')
    .get(catalogId, entityId, step) as { content_hash: string | null } | undefined)?.content_hash;

const revisions = (entityId: string, step: string) =>
  (getDb().prepare('SELECT COUNT(*) AS n FROM pipeline_artifact_revisions WHERE catalog_id = ? AND entity_id = ? AND step = ?')
    .get(CAT, entityId, step) as { n: number }).n;

describe('content_hash — stamped at the write door', () => {
  it('stamps stepContentHash(data); an identical re-upsert with a new verdict (the drain shape) keeps it; new data restamps', () => {
    put('e1', 'S', D);
    expect(storedHash('e1', 'S')).toBe(stepContentHash(D));

    // Drain / verify-static / verify-packaging: SAME data, different status + reason.
    put('e1', 'S', D, { status: 'fail', tier: 'L3', reason: 'gate failed' });
    const afterDrain = storedHash('e1', 'S');
    expect(afterDrain).not.toBeNull();
    expect(afterDrain).toBe(stepContentHash(D));

    put('e1', 'S', D2);
    expect(storedHash('e1', 'S')).toBe(stepContentHash(D2));
  });

  it('a provenance-only rewrite (data text differs, hash does not) still leaves a stored hash', () => {
    put('e1', 'P', { ...D, _provenance: { engine: 'a' } });
    put('e1', 'P', { ...D, _provenance: { engine: 'b' } });
    expect(storedHash('e1', 'P')).toBe(stepContentHash(D));
  });
});

describe('content_hash — never outlives the content it names', () => {
  it('a foreign-scheme stored hash ("v2-…") is re-derived on read, never served', () => {
    put('e2', 'S', D);
    getDb().prepare("UPDATE pipeline_artifacts SET content_hash = 'v2-abc-def' WHERE catalog_id = ? AND entity_id = 'e2' AND step = 'S'").run(CAT);
    const row = listArtifactVerdicts(CAT, 'e2').find((r) => r.step === 'S')!;
    expect(row.contentHash).toBe(stepContentHash(D));
  });

  it('a writer that bypasses the door (raw UPDATE of data) cannot leave the stale hash behind', () => {
    put('e3', 'S', D);
    getDb().prepare("UPDATE pipeline_artifacts SET data = ? WHERE catalog_id = ? AND entity_id = 'e3' AND step = 'S'")
      .run(JSON.stringify(D2), CAT);
    const row = listArtifactVerdicts(CAT, 'e3').find((r) => r.step === 'S')!;
    expect(row.contentHash).toBe(stepContentHash(D2));
    // A raw write that leaves data byte-identical is NOT an invalidation (the trigger compares values).
    put('e3', 'T', D);
    getDb().prepare("UPDATE pipeline_artifacts SET data = data, status = 'fail' WHERE catalog_id = ? AND entity_id = 'e3' AND step = 'T'").run(CAT);
    expect(storedHash('e3', 'T')).toBe(stepContentHash(D));
  });
});

describe('listArtifactVerdicts — the blob-free read', () => {
  it('returns no data key, the full-read hash and the ue assets; a corrupt blob with a stored hash is still returned', () => {
    put('e4', 'A', D);
    put('e4', 'B', D2, { status: 'deferred', tier: 'L2', reason: 'queued' });
    const full = listArtifacts(CAT, 'e4');
    const lean = listArtifactVerdicts(CAT, 'e4');
    expect(lean).toHaveLength(full.length);
    for (const f of full) {
      const l = lean.find((r) => r.step === f.step)!;
      expect(l).not.toHaveProperty('data');
      expect(l.contentHash).toBe(stepContentHash(f.data));
      expect(l.ueAssets).toEqual(f.ueAssets);
      expect(l).toMatchObject({ catalogId: CAT, entityId: 'e4', status: f.status, updatedAt: f.updatedAt });
    }
    expect(lean.find((r) => r.step === 'B')).toMatchObject({ tier: 'L2', reason: 'queued' });

    // Corrupt the blob, THEN stamp a hash in its own statement (a data change with an unchanged
    // hash is exactly what the invalidation trigger NULLs; an UPDATE of content_hash alone is not).
    getDb().prepare("UPDATE pipeline_artifacts SET data = '{not json' WHERE catalog_id = ? AND entity_id = 'e4' AND step = 'A'").run(CAT);
    getDb().prepare("UPDATE pipeline_artifacts SET content_hash = ? WHERE catalog_id = ? AND entity_id = 'e4' AND step = 'A'")
      .run(stepContentHash(D), CAT);
    expect(() => listArtifacts(CAT, 'e4')).toThrow(SyntaxError);
    const corrupt = listArtifactVerdicts(CAT, 'e4').find((r) => r.step === 'A')!;
    expect(corrupt).toMatchObject({ status: 'pass', contentHash: stepContentHash(D) });
  });
});

describe('archive behaviour (guard)', () => {
  it('an identical re-upsert archives nothing; a changed one archives exactly one version', () => {
    put('e5', 'S', D);
    put('e5', 'S', D, { status: 'fail' });
    expect(revisions('e5', 'S')).toBe(0);
    put('e5', 'S', D2);
    expect(revisions('e5', 'S')).toBe(1);
  });
});

describe('an existing DB created with the OLD DDL', () => {
  it('gains the column additively and is backfilled in place — no row lost', async () => {
    const file = path.join(os.tmpdir(), `pof-test-artifact-old-ddl-${process.pid}-${Date.now()}.db`);
    const old = new Database(file);
    old.exec(`CREATE TABLE pipeline_artifacts (
      catalog_id TEXT NOT NULL, entity_id TEXT NOT NULL, step TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}', ue_assets TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending', tier TEXT, reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step))`);
    const ins = old.prepare('INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, status) VALUES (?, ?, ?, ?, ?)');
    const bodies = [D, D2, { other: [1, 2, 3], _provenance: { engine: 'x' } }];
    bodies.forEach((b, i) => ins.run('old', `o${i}`, 'S', JSON.stringify(b), 'pass'));
    old.close();

    const prev = process.env.POF_DB_PATH;
    process.env.POF_DB_PATH = file;
    try {
      vi.resetModules();
      const mod = await import('@/lib/pipeline-artifacts-db');
      const dbMod = await import('@/lib/db');
      expect(mod.listArtifactVerdicts('old')).toHaveLength(3); // runs ensureTable (migration + backfill)
      const conn = dbMod.getDb();
      const cols = (conn.prepare('PRAGMA table_info(pipeline_artifacts)').all() as { name: string }[]).map((c) => c.name);
      expect(cols).toContain('content_hash');
      expect((conn.prepare('SELECT COUNT(*) AS n FROM pipeline_artifacts').get() as { n: number }).n).toBe(3);
      const rows = conn.prepare('SELECT data, content_hash FROM pipeline_artifacts').all() as { data: string; content_hash: string | null }[];
      for (const r of rows) expect(r.content_hash).toBe(stepContentHash(JSON.parse(r.data)));
      conn.close();
    } finally {
      process.env.POF_DB_PATH = prev;
      vi.resetModules();
      for (const f of [file, `${file}-wal`, `${file}-shm`]) {
        try { fs.rmSync(f, { force: true }); } catch { /* best-effort temp cleanup */ }
      }
    }
  });
});
