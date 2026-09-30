/**
 * `src/lib/project-progress-db.ts` — the ONE owner of a project's progress row.
 *
 * Before it, three routes each hashed the project path themselves (none through
 * `normalizeProjectId`), so `C:/x/PoF/` and `C:/x/PoF` were two rows. The id is
 * now `sha256(normalizeProjectId(path))`, which equals the legacy hash for every
 * canonical spelling (existing rows keep their id) — and a row already stored
 * under the legacy hash of a NON-canonical spelling is folded in losslessly, so
 * normalizing the id never makes a user's existing progress disappear.
 *
 * Throwaway DB in a per-file mkdtemp dir (deleted in afterAll).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-progress-db-'));
process.env.POF_DB_PATH = path.join(DIR, 'pof.db');

const { getDb } = await import('@/lib/db');
const { progressRowId, legacyProgressRowId, readProgress, saveProgress, markComplete } = await import(
  '@/lib/project-progress-db'
);

afterAll(() => {
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(DIR, { recursive: true, force: true });
});

const CANONICAL = 'C:\\Users\\x\\Unreal Projects\\PoF';
const TRAILING = 'C:/Users/x/Unreal Projects/PoF/';
const LOWER = 'c:\\users\\x\\unreal projects\\pof';

const legacyHash = (p: string) =>
  crypto.createHash('sha256').update(p.toLowerCase().replace(/\\/g, '/')).digest('hex').slice(0, 16);

type Row = { project_id: string; checklist_json: string; completed_json: string };

function seed(id: string, checklist: unknown, completed: unknown = {}) {
  getDb()
    .prepare(
      `INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, completed_json, updated_at)
       VALUES (?, ?, '{}', '{}', '{}', ?, datetime('now'))`,
    )
    .run(id, JSON.stringify(checklist), JSON.stringify(completed));
}

const row = (id: string) =>
  getDb().prepare('SELECT * FROM project_progress WHERE project_id = ?').get(id) as Row | undefined;

beforeEach(() => {
  getDb().prepare('DELETE FROM project_progress').run();
});

describe('progressRowId — one id per project', () => {
  it('[guard] equals the legacy hash for a canonical spelling, so existing rows keep their id', () => {
    expect(progressRowId(CANONICAL)).toBe(legacyHash(CANONICAL));
    expect(progressRowId(CANONICAL)).toBe('c58df4d001ee0b99');
    expect(legacyProgressRowId(CANONICAL)).toBe('c58df4d001ee0b99');
  });

  it('gives a trailing-slash and a lower-case spelling the same id (today a second row)', () => {
    expect(legacyHash(TRAILING)).toBe('cb3f10867964f9fd');
    expect(progressRowId(TRAILING)).toBe('c58df4d001ee0b99');
    expect(progressRowId(LOWER)).toBe('c58df4d001ee0b99');
    expect(legacyProgressRowId(TRAILING)).toBe('cb3f10867964f9fd');
  });

  it('no route defines its own projectId() — all three import the one helper', () => {
    for (const rel of [
      'src/app/api/project-progress/route.ts',
      'src/app/api/checklist/complete/route.ts',
      'src/app/api/recent-projects/route.ts',
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src, rel).not.toMatch(/function projectId\s*\(/);
      expect(src, rel).not.toMatch(/createHash\(/);
      expect(src, rel).toContain("from '@/lib/project-progress-db'");
    }
  });
});

describe('legacy non-canonical rows are folded, never lost', () => {
  it('readProgress returns a row stored under the legacy trailing-slash hash', () => {
    seed('cb3f10867964f9fd', { 'arpg-combat': { 'acb-1': true } }, { 'arpg-combat': { 'acb-1': 111 } });
    const got = readProgress(TRAILING);
    expect(got.checklistProgress['arpg-combat']?.['acb-1']).toBe(true);
    expect(got.checklistCompletedAt['arpg-combat']?.['acb-1']).toBe(111);
  });

  it('folding is lossless — a true mark is never overwritten by false, earliest date wins', () => {
    seed('c58df4d001ee0b99', { 'arpg-combat': { 'acb-1': false, 'acb-2': true } }, { 'arpg-combat': { 'acb-2': 500 } });
    seed('cb3f10867964f9fd', { 'arpg-combat': { 'acb-1': true, 'acb-2': true } }, { 'arpg-combat': { 'acb-1': 7, 'acb-2': 300 } });
    const got = readProgress(TRAILING);
    expect(got.checklistProgress['arpg-combat']).toMatchObject({ 'acb-1': true, 'acb-2': true });
    expect(got.checklistCompletedAt['arpg-combat']).toEqual({ 'acb-1': 7, 'acb-2': 300 });
  });

  it('a write folds the legacy row into the canonical id without deleting or rewriting it', () => {
    seed('cb3f10867964f9fd', { 'arpg-combat': { 'acb-1': true } });
    const before = row('cb3f10867964f9fd');
    saveProgress(TRAILING, { checklistProgress: { 'arpg-combat': { 'acb-3': true } } });

    // Reachable from the canonical spelling now.
    expect(readProgress(CANONICAL).checklistProgress['arpg-combat']).toMatchObject({ 'acb-1': true, 'acb-3': true });
    // The legacy row is untouched.
    expect(row('cb3f10867964f9fd')).toEqual(before);
  });

  it('after the fold an un-done item stays un-done (the legacy true does not resurrect it)', () => {
    seed('cb3f10867964f9fd', { 'arpg-combat': { 'acb-1': true } });
    saveProgress(TRAILING, { checklistProgress: { 'arpg-combat': { 'acb-3': true } } });
    saveProgress(CANONICAL, { checklistProgress: { 'arpg-combat': { 'acb-1': false } } });
    expect(readProgress(TRAILING).checklistProgress['arpg-combat']?.['acb-1']).toBe(false);
    expect(readProgress(CANONICAL).checklistProgress['arpg-combat']?.['acb-1']).toBe(false);
  });
});

describe('markComplete — the CLI path stamps a date', () => {
  it('stamps `at` on the first completion and keeps the earliest on a repeat', () => {
    markComplete(CANONICAL, 'arpg-combat', 'acb-1', 1000);
    markComplete(TRAILING, 'arpg-combat', 'acb-1', 2000);
    const got = readProgress(LOWER);
    expect(got.checklistProgress['arpg-combat']?.['acb-1']).toBe(true);
    expect(got.checklistCompletedAt['arpg-combat']?.['acb-1']).toBe(1000);
    expect(JSON.parse(row('c58df4d001ee0b99')!.completed_json)).toEqual({ 'arpg-combat': { 'acb-1': 1000 } });
  });
});

describe('schema 5 is additive', () => {
  it('upgrades a user_version 4 row in place: columns added with defaults, the row untouched', async () => {
    const { default: Database } = await import('better-sqlite3');
    const file = path.join(DIR, 'v4.db');
    const raw = new Database(file);
    raw.exec(`CREATE TABLE project_progress (
      project_id TEXT PRIMARY KEY, checklist_json TEXT NOT NULL DEFAULT '{}', health_json TEXT NOT NULL DEFAULT '{}',
      verification_json TEXT NOT NULL DEFAULT '{}', history_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    raw.prepare("INSERT INTO project_progress (project_id, checklist_json) VALUES ('abc', ?)").run(
      JSON.stringify({ 'arpg-combat': { 'acb-1': true } }),
    );
    raw.pragma('user_version = 4');
    raw.close();

    const prev = process.env.POF_DB_PATH;
    process.env.POF_DB_PATH = file;
    vi.resetModules();
    const fresh = await import('@/lib/db');
    const db = fresh.getDb();
    try {
      const r = db.prepare("SELECT * FROM project_progress WHERE project_id = 'abc'").get() as Record<string, string>;
      expect(JSON.parse(r.checklist_json)).toEqual({ 'arpg-combat': { 'acb-1': true } });
      expect(r.completed_json).toBe('{}');
      expect(r.folded_json).toBe('[]');
      expect(db.pragma('user_version', { simple: true })).toBe(5);
    } finally {
      db.close();
      process.env.POF_DB_PATH = prev;
    }
  });
});
