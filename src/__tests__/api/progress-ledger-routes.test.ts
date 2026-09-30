/**
 * The progress routes are thin callers of `src/lib/project-progress-db.ts`: one
 * merge (per-key checklist, orphan migration on EVERY write, earliest-wins
 * completion ledger pruned to done items), dated CLI completions, and a recent-
 * projects % counted by the app's own rule (`countAllChecklists`) from the real
 * progress row instead of a client snapshot counted key by key.
 *
 * Real route handlers against the real SQLite schema. Throwaway DB in a per-file
 * mkdtemp dir (deleted in afterAll).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-progress-routes-'));
process.env.POF_DB_PATH = path.join(DIR, 'pof.db');

const { getDb } = await import('@/lib/db');
const progressRoute = await import('@/app/api/project-progress/route');
const completeRoute = await import('@/app/api/checklist/complete/route');
const recentRoute = await import('@/app/api/recent-projects/route');
const { countAllChecklists } = await import('@/lib/checklist-progress');

afterAll(() => {
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(DIR, { recursive: true, force: true });
});

const PROJECT = 'C:\\Users\\x\\Unreal Projects\\PoF';
const ROW_ID = 'c58df4d001ee0b99'; // canonical id of PROJECT (== legacy hash)
const T1 = Date.UTC(2026, 8, 1);
const T2 = Date.UTC(2026, 8, 8);

const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function postProgress(body: Record<string, unknown>) {
  const res = await progressRoute.POST(json('http://localhost/api/project-progress', { projectPath: PROJECT, ...body }));
  expect(res.status).toBe(200);
}

async function getProgress() {
  const res = await progressRoute.GET(
    new NextRequest(`http://localhost/api/project-progress?path=${encodeURIComponent(PROJECT)}`),
  );
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data as {
    checklistProgress: Record<string, Record<string, boolean>>;
    checklistCompletedAt: Record<string, Record<string, number>>;
  };
}

function seed(checklist: unknown, completed: unknown = {}) {
  getDb()
    .prepare(
      `INSERT INTO project_progress (project_id, checklist_json, health_json, verification_json, history_json, completed_json, updated_at)
       VALUES (?, ?, '{}', '{}', '{}', ?, datetime('now'))`,
    )
    .run(ROW_ID, JSON.stringify(checklist), JSON.stringify(completed));
}

const storedChecklist = () =>
  JSON.parse(
    (getDb().prepare('SELECT checklist_json FROM project_progress WHERE project_id = ?').get(ROW_ID) as {
      checklist_json: string;
    }).checklist_json,
  ) as Record<string, Record<string, boolean>>;

beforeEach(() => {
  getDb().prepare('DELETE FROM project_progress').run();
  getDb().prepare('DELETE FROM recent_projects').run();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dated CLI completions', () => {
  it('POST /api/checklist/complete stamps Date.now() into the row the GET returns', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(T1);
    const res = await completeRoute.POST(
      json('http://localhost/api/checklist/complete', { moduleId: 'arpg-combat', itemId: 'acb-1', projectPath: PROJECT }),
    );
    expect(res.status).toBe(200);
    const data = await getProgress();
    expect(data.checklistProgress['arpg-combat']?.['acb-1']).toBe(true);
    expect(data.checklistCompletedAt['arpg-combat']?.['acb-1']).toBe(T1);
  });
});

describe('POST /api/project-progress — the one merge', () => {
  it('ledger union keeps the earliest stamp', async () => {
    seed({ 'arpg-combat': { 'acb-1': true } }, { 'arpg-combat': { 'acb-1': T1 } });
    await postProgress({
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
      checklistCompletedAt: { 'arpg-combat': { 'acb-1': T2 } },
    });
    expect((await getProgress()).checklistCompletedAt['arpg-combat']?.['acb-1']).toBe(T1);
  });

  it('with nothing stored the client stamp is adopted', async () => {
    await postProgress({
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
      checklistCompletedAt: { 'arpg-combat': { 'acb-1': T2 } },
    });
    expect((await getProgress()).checklistCompletedAt['arpg-combat']?.['acb-1']).toBe(T2);
  });

  it('un-done drops the date on the server too', async () => {
    seed({ 'arpg-combat': { 'acb-1': true } }, { 'arpg-combat': { 'acb-1': T1 } });
    await postProgress({ checklistProgress: { 'arpg-combat': { 'acb-1': false } } });
    const data = await getProgress();
    expect(data.checklistProgress['arpg-combat']?.['acb-1']).toBe(false);
    expect(data.checklistCompletedAt['arpg-combat']?.['acb-1']).toBeUndefined();
  });

  it('migrates a stored orphan key on the autosave path, not only on checklist/complete', async () => {
    seed({ materials: { 'mt-1': true } });
    await postProgress({ checklistProgress: { 'arpg-combat': { 'acb-2': true } } });
    const stored = storedChecklist();
    expect(stored.materials?.['mat-2']).toBe(true);
    expect(stored.materials).not.toHaveProperty('mt-1');
    expect(stored['arpg-combat']?.['acb-2']).toBe(true);
  });
});

describe('GET /api/recent-projects counts the real row by the app rule', () => {
  it('1 declared item + 1 orphan key is 1/total, not 2/2 = 100%', async () => {
    getDb()
      .prepare(
        `INSERT INTO recent_projects (id, project_name, project_path, ue_version, checklist_json, last_opened_at)
         VALUES (?, 'PoF', ?, '5.5', '{}', datetime('now'))`,
      )
      .run(ROW_ID, PROJECT);
    seed({ 'arpg-combat': { 'acb-1': true }, zzz: { 'orphan-x': true } });

    const res = await recentRoute.GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    const [p] = body.data as { checklistDone: number; checklistTotal: number }[];
    expect(p.checklistDone).toBe(1);
    expect(p.checklistTotal).toBe(countAllChecklists({}).total);
    expect(p.checklistTotal).toBeGreaterThan(2);
  });
});
