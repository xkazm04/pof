/**
 * `project_rules` gains a `profile` column (canon profiles, /diablo W01). The real DB predates it,
 * so the migration is the load-bearing case: an OLD-SCHEMA table must gain the column with every
 * existing row reading as PoF's, and a profile rule must survive the write → read → POST path with
 * its profile intact (dropping it would silently move a Diablo rule into PoF's world).
 * Throwaway DBs via `POF_DB_PATH`; the user's `~/.pof/pof.db` is never opened.
 */
import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP = process.env.TEMP || process.env.TMPDIR || '/tmp';

function newDbFile(tag: string): string {
  const file = path.join(TMP, `pof-test-profiles-${process.pid}-${tag}.db`);
  for (const s of ['', '-wal', '-shm']) if (fs.existsSync(file + s)) fs.rmSync(file + s);
  return file;
}

async function load(file: string) {
  process.env.POF_DB_PATH = file;
  vi.resetModules();
  return { rules: await import('@/lib/project-rules-db'), route: await import('@/app/api/project-rules/route') };
}

describe('profile column migration', () => {
  it('an old-schema table gains the column; its rows read back as PoF rules, unchanged', async () => {
    const file = newDbFile('old');
    const db = new Database(file);
    db.exec(`CREATE TABLE project_rules (id TEXT PRIMARY KEY, category TEXT NOT NULL, scope TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, refs TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    db.prepare(`INSERT INTO project_rules (id, category, scope, title, body) VALUES ('mine', 'game', 'global', 'Mine', 'curated')`).run();
    db.close();

    const { rules } = await load(file);
    const mine = rules.listRules().find((r) => r.id === 'mine')!;
    expect(mine).toMatchObject({ id: 'mine', body: 'curated' });
    expect(mine.profile).toBeUndefined(); // read back exactly as before: PoF's
    const cols = (new Database(file).prepare('PRAGMA table_info(project_rules)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('profile');
  });
});

describe('a profile rule keeps its profile', () => {
  it('upsert → list round-trips the profile', async () => {
    const { rules } = await load(newDbFile('roundtrip'));
    rules.upsertRule({ id: 'd1-rt', category: 'art', scope: 'global', title: 'T', body: 'B', profile: 'diablo1' });
    expect(rules.listRules().find((r) => r.id === 'd1-rt')?.profile).toBe('diablo1');
  });

  it('POST /api/project-rules carries the profile, and refuses an unregistered one', async () => {
    const { rules, route } = await load(newDbFile('post'));
    const post = (body: unknown) => route.POST(new NextRequest('http://localhost/api/project-rules', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    }));
    const ok = await post({ id: 'd1-post', category: 'art', scope: 'global', title: 'T', body: 'B', profile: 'diablo1' });
    expect(ok.status).toBe(200);
    expect(rules.listRules().find((r) => r.id === 'd1-post')?.profile).toBe('diablo1');
    const bad = await post({ id: 'x', category: 'art', scope: 'global', title: 'T', body: 'B', profile: 'diablo2' });
    expect(bad.status).toBe(400);
  });
});
