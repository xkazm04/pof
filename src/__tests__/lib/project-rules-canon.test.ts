/**
 * `project_rules` is the project canon — the rules cited into step-recipe produce
 * prompts and the judge's context. The live table holds 61 rows against a seed of
 * 66, so the operator HAS been pruning it.
 *
 * The defect this suite pins: seeding was inferred from `count === 0`, inside an
 * `ensureTable()` that every exported function calls. Deleting the LAST remaining
 * rule reported success and the very next `listRules()` silently resurrected the
 * whole `CANON_SEED` — while a PARTIAL deletion stuck. Nobody can predict that
 * from the UI, and nothing in the API said it happened.
 *
 * Every case runs against a throwaway DB via `POF_DB_PATH`; the user's real
 * `~/.pof/pof.db` is never opened here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';
const madeFiles: string[] = [];
let openHandles: Database.Database[] = [];

const PROJECT_RULES_DDL = `
  CREATE TABLE project_rules (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    scope TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    refs TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

function newDbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-canon-${process.pid}-${tag}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
  madeFiles.push(file);
  return file;
}

/** Load a FRESH copy of the rules module bound to `file` — a new "process". */
async function loadRules(file: string) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  const dbMod = await import('@/lib/db');
  const rules = await import('@/lib/project-rules-db');
  return { rules, dbMod };
}

afterEach(() => {
  for (const h of openHandles) {
    try { h.close(); } catch { /* already closed */ }
  }
  openHandles = [];
});

// ─────────────────────────────────────────────────────────────────────────────

describe('a fresh database still gets the canon', () => {
  it('seeds CANON_SEED on first use', async () => {
    const { rules } = await loadRules(newDbFile('fresh'));
    expect(rules.listRules()).toHaveLength(CANON_SEED.length);
  });
});

describe('the canon cannot resurrect itself', () => {
  it('stays EMPTY after the user deletes every rule', async () => {
    const { rules } = await loadRules(newDbFile('empty'));
    for (const rule of rules.listRules()) rules.deleteRule(rule.id);

    // RED before the fix: this returned the full CANON_SEED — the delete and the
    // resurrection shared one code path.
    expect(rules.listRules()).toEqual([]);
  });

  it('stays empty across a restart, not just within one process', async () => {
    const file = newDbFile('empty-restart');
    const first = await loadRules(file);
    for (const rule of first.rules.listRules()) first.rules.deleteRule(rule.id);
    first.dbMod.getDb().close();

    const second = await loadRules(file);
    expect(second.rules.listRules()).toEqual([]);
  });

  it('keeps a PARTIAL deletion partial — the two cases now behave the same', async () => {
    const { rules } = await loadRules(newDbFile('partial'));
    const all = rules.listRules();
    for (const rule of all.slice(0, all.length - 1)) rules.deleteRule(rule.id);
    expect(rules.listRules()).toHaveLength(1);

    rules.deleteRule(rules.listRules()[0].id);
    expect(rules.listRules()).toHaveLength(0);
  });
});

describe('a database that predates the seed marker is adopted, never re-seeded', () => {
  it('leaves an existing curated table exactly as it is', async () => {
    const file = newDbFile('adopt');
    const raw = new Database(file);
    raw.exec(PROJECT_RULES_DDL);
    raw.prepare("INSERT INTO project_rules (id, category, scope, title, body) VALUES (?,?,?,?,?)")
      .run('mine-1', 'game', 'global', 'My rule', 'Only this one.');
    raw.close();

    const { rules } = await loadRules(file);
    expect(rules.listRules().map((r) => r.id)).toEqual(['mine-1']);
  });

  it('leaves an existing EMPTIED table empty — the curated-to-zero user is not overruled', async () => {
    const file = newDbFile('adopt-empty');
    const raw = new Database(file);
    raw.exec(PROJECT_RULES_DDL);
    raw.close();

    // RED before the fix: 66 rules the user had already deleted came back.
    const { rules } = await loadRules(file);
    expect(rules.listRules()).toEqual([]);
  });
});

describe('restoring the defaults is an explicit, named act', () => {
  it('restoreCanonSeed() puts the canon back and reports how many rules it wrote', async () => {
    const { rules } = await loadRules(newDbFile('restore'));
    for (const rule of rules.listRules()) rules.deleteRule(rule.id);
    expect(rules.listRules()).toEqual([]);

    const result = rules.restoreCanonSeed();
    expect(result.restored).toBe(CANON_SEED.length);
    expect(result.total).toBe(CANON_SEED.length);
    expect(rules.listRules()).toHaveLength(CANON_SEED.length);
  });

  it('does not clobber a rule the user edited under a seeded id', async () => {
    const { rules } = await loadRules(newDbFile('restore-merge'));
    const mine = { id: 'my-own-rule', category: 'game' as const, scope: 'global', title: 'Mine', body: 'Kept.', refs: [] };
    rules.upsertRule(mine);

    const result = rules.restoreCanonSeed();
    expect(result.total).toBe(CANON_SEED.length + 1);
    expect(rules.listRules().find((r) => r.id === 'my-own-rule')?.body).toBe('Kept.');
  });
});

describe('through the API route the user actually reaches', () => {
  it('empties on DELETE and stays empty on GET, and restore-defaults is what brings it back', async () => {
    const file = newDbFile('route');
    process.env.POF_DB_PATH = file;
    vi.resetModules();
    const route = await import('@/app/api/project-rules/route');
    const { NextRequest } = await import('next/server');

    const read = async () => {
      const res = await route.GET();
      return (await res.json()).data as { id: string }[];
    };

    const seeded = await read();
    expect(seeded).toHaveLength(CANON_SEED.length);

    for (const rule of seeded) {
      const res = await route.DELETE(
        new NextRequest(`http://localhost/api/project-rules?id=${encodeURIComponent(rule.id)}`, { method: 'DELETE' }),
      );
      expect((await res.json()).success).toBe(true);
    }

    // RED before the fix: DELETE reported success on the LAST rule and this read
    // handed back all 66 again.
    expect(await read()).toEqual([]);

    const restored = await route.POST(
      new NextRequest('http://localhost/api/project-rules?action=restore-defaults', { method: 'POST' }),
    );
    expect((await restored.json()).data.restored).toBe(CANON_SEED.length);
    expect(await read()).toHaveLength(CANON_SEED.length);
  });
});

describe('ensureTable is memoized like every sibling *-db module', () => {
  it('stops re-running CREATE TABLE and COUNT(*) on every single call', async () => {
    const { rules, dbMod } = await loadRules(newDbFile('memo'));
    rules.listRules(); // first call does the ensure

    const handle = dbMod.getDb();
    openHandles.push(handle);
    const execSpy = vi.spyOn(handle, 'exec');
    const prepareSpy = vi.spyOn(handle, 'prepare');

    rules.listRules();
    rules.listRules();
    rules.listRules();

    const creates = execSpy.mock.calls.filter(([sql]) => String(sql).includes('CREATE TABLE'));
    const counts = prepareSpy.mock.calls.filter(([sql]) => String(sql).includes('COUNT(*) as cnt FROM project_rules'));
    // RED before the fix: 3 and 3 — one of each per exported call, forever.
    expect(creates).toHaveLength(0);
    expect(counts).toHaveLength(0);

    execSpy.mockRestore();
    prepareSpy.mockRestore();
  });
});
