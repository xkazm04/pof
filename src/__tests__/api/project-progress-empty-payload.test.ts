/**
 * `/api/project-progress` POST must not destroy a row's derived blobs on an empty save.
 *
 * The checklist has always MERGED (the CLI writes completions out-of-band), but
 * `health_json` / `verification_json` / `history_json` were overwritten with whatever
 * the client sent — including `{}`. Wave 18 makes the client legitimately hold an EMPTY
 * store far more often (it now clears module progress on a project switch / reset and on
 * a failed load, rather than rendering the previous project's marks as this project's),
 * so an empty save became a live path to silently wiping semantic verification and task
 * history for a project that has both.
 *
 * RED before this change: the second POST below left `verification_json` = `{}`.
 *
 * Runs the real route handlers against the real SQLite schema (throwaway DB).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-project-progress-empty-${process.pid}.db`;
});

import { GET, POST } from '@/app/api/project-progress/route';
import { getDb } from '@/lib/db';

const PROJECT = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/project-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function load() {
  return GET(
    new NextRequest(`http://localhost/api/project-progress?path=${encodeURIComponent(PROJECT)}`),
  );
}

const REAL_VERIFICATION = {
  'arpg-combat': {
    'acb-1': { status: 'full', completeness: 1, missingMembers: [], verifiedAt: 1 },
  },
};
const REAL_HISTORY = {
  'arpg-combat': [{ id: 'h1', moduleId: 'arpg-combat', action: 'scan', timestamp: 1 }],
};
const REAL_HEALTH = { 'arpg-combat': { score: 80, tasksCompleted: 4, status: 'in-progress' } };

beforeEach(() => {
  getDb().prepare('DELETE FROM project_progress').run();
});

describe('POST /api/project-progress with an empty payload', () => {
  it('preserves stored health / verification / history', async () => {
    await post({
      projectPath: PROJECT,
      checklistProgress: { 'arpg-combat': { 'acb-1': true } },
      moduleHealth: REAL_HEALTH,
      checklistVerification: REAL_VERIFICATION,
      moduleHistory: REAL_HISTORY,
    });

    // A cleared client (switch / reset / failed load) saves an empty store.
    const res = await post({
      projectPath: PROJECT,
      checklistProgress: {},
      moduleHealth: {},
      checklistVerification: {},
      moduleHistory: {},
    });
    expect(res.status).toBe(200);

    const body = await (await load()).json();
    expect(body.success).toBe(true);
    expect(body.data.checklistVerification).toEqual(REAL_VERIFICATION);
    expect(body.data.moduleHistory).toEqual(REAL_HISTORY);
    expect(body.data.moduleHealth).toEqual(REAL_HEALTH);
    // The checklist merge behaviour is unchanged.
    expect(body.data.checklistProgress).toEqual({ 'arpg-combat': { 'acb-1': true } });
  });

  it('preserves stored blobs when the fields are absent entirely', async () => {
    await post({
      projectPath: PROJECT,
      checklistProgress: {},
      moduleHealth: REAL_HEALTH,
      checklistVerification: REAL_VERIFICATION,
      moduleHistory: REAL_HISTORY,
    });
    await post({ projectPath: PROJECT, checklistProgress: { 'arpg-loot': { 'al-1': true } } });

    const body = await (await load()).json();
    expect(body.data.checklistVerification).toEqual(REAL_VERIFICATION);
    expect(body.data.moduleHistory).toEqual(REAL_HISTORY);
    expect(body.data.moduleHealth).toEqual(REAL_HEALTH);
  });

  it('still overwrites when the client sends real values', async () => {
    await post({
      projectPath: PROJECT,
      checklistProgress: {},
      moduleHealth: REAL_HEALTH,
      checklistVerification: REAL_VERIFICATION,
      moduleHistory: REAL_HISTORY,
    });

    const nextHealth = { 'arpg-combat': { score: 100, tasksCompleted: 8, status: 'healthy' } };
    await post({
      projectPath: PROJECT,
      checklistProgress: {},
      moduleHealth: nextHealth,
      checklistVerification: {},
      moduleHistory: {},
    });

    const body = await (await load()).json();
    expect(body.data.moduleHealth).toEqual(nextHealth);
    // …and the two it did NOT send are still intact.
    expect(body.data.checklistVerification).toEqual(REAL_VERIFICATION);
  });

  it('creates an empty row for a brand-new project path', async () => {
    const res = await post({
      projectPath: 'C:\\Users\\kazda\\Documents\\Unreal Projects\\brand-new',
      checklistProgress: {},
      moduleHealth: {},
      checklistVerification: {},
      moduleHistory: {},
    });
    expect(res.status).toBe(200);

    const body = await (
      await GET(
        new NextRequest(
          'http://localhost/api/project-progress?path=' +
            encodeURIComponent('C:\\Users\\kazda\\Documents\\Unreal Projects\\brand-new'),
        ),
      )
    ).json();
    expect(body.data.checklistProgress).toEqual({});
    expect(body.data.checklistVerification).toEqual({});
  });
});
