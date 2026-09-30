/**
 * Release versions are a PER-PROJECT projection of build_history, not one global counter.
 *
 * Before: every writer (interactive cook, nightly runner, manual record) and every reader
 * (dashboard, `action=version`) shared ONE settings key (`build_version`) while every
 * build_history read was project-scoped. Project B's first green cook took the number
 * project A had advanced to; a minor bump stored x.y.0 as CURRENT so the next green cook
 * was x.y.1 and no build was ever x.y.0.
 *
 * Rule (coordinator revision): the current version of a project is the max semver over
 * EVERY versioned row in its scope, whatever the row's status — a smoke-condemned build
 * keeps (burns) its number and that number is never reissued. No recorded row is rewritten.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-project-version-authority-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import { getDb, getSetting, setSetting } from '@/lib/db';
import { attachSmokeResultToLatestBuild, getBuild } from '@/lib/packaging/build-history-store';
import { finalizeCook, type CookFinalOutcome, type FinalizeContext } from '@/lib/packaging/finalize-build';
import { defaultRunnerDeps } from '@/lib/packaging/scheduled-build-runner';
import { GET, POST } from '@/app/api/packaging/history/route';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

const DONE: CookFinalOutcome = { kind: 'done', exePath: 'C:\\out\\Game.exe', durationMs: 1000, sizeBytes: null };

function ctx(projectPath: string, extra: Partial<FinalizeContext> = {}): FinalizeContext {
  return { projectPath, platform: 'Win64', config: 'Shipping', ...extra };
}

/** A green cook through the ONE finalizer, wired with the real store deps. */
function cook(projectPath: string, extra: Partial<FinalizeContext> = {}) {
  return finalizeCook(DONE, ctx(projectPath, extra), defaultRunnerDeps());
}

function get(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/packaging/history?${query}`);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/packaging/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function data<T>(res: Response): Promise<T> {
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data as T;
}

const qA = `projectPath=${encodeURIComponent(PROJECT_A)}`;
const qB = `projectPath=${encodeURIComponent(PROJECT_B)}`;

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM build_history').run();
  db.prepare("DELETE FROM settings WHERE key = 'build_version' OR key LIKE 'build_version_next:%'").run();
});

describe('version assignment is per project', () => {
  it('A cooks twice, then B: A carries 0.1.1/0.1.2 and B starts at its own 0.1.1', () => {
    expect(cook(PROJECT_A).version).toBe('0.1.1');
    expect(cook(PROJECT_A).version).toBe('0.1.2');
    expect(cook(PROJECT_B).version).toBe('0.1.1');
    // Rollback safety: the legacy global key never falls below an issued number.
    expect(getSetting('build_version')).toBe('0.1.2');
  });
});

describe('a bump is an intent relative to the last shipped version', () => {
  it('minor after 0.1.2 makes the next green cook 0.2.0 — pressed twice, still 0.2.0', async () => {
    cook(PROJECT_A);
    cook(PROJECT_A);
    await data(await POST(post({ action: 'bump-version', type: 'minor', projectPath: PROJECT_A })));
    const second = await data<{ version: string; nextVersion: string }>(
      await POST(post({ action: 'bump-version', type: 'minor', projectPath: PROJECT_A })),
    );
    expect(second.version).toBe('0.1.2');
    expect(second.nextVersion).toBe('0.2.0');
    expect(cook(PROJECT_A).version).toBe('0.2.0');
    // The intent is consumed by the build that took it.
    expect(cook(PROJECT_A).version).toBe('0.2.1');
  });

  it("one project's bump never moves another's next version", async () => {
    cook(PROJECT_A);
    await data(await POST(post({ action: 'bump-version', type: 'minor', projectPath: PROJECT_A })));
    const b = await data<{ version: string; nextVersion: string }>(await GET(get(`action=dashboard&${qB}`)));
    expect(b.nextVersion).toBe('0.1.1');
  });
});

describe('the dashboard and the version read name the same scoped truth', () => {
  it('dashboard version is A\'s last shipped and nextVersion is what a record then assigns', async () => {
    cook(PROJECT_A);
    cook(PROJECT_A);
    cook(PROJECT_B);
    cook(PROJECT_B);
    cook(PROJECT_B);
    const dash = await data<{ version: string; nextVersion: string }>(await GET(get(`action=dashboard&${qA}`)));
    expect(dash.version).toBe('0.1.2');
    expect(dash.nextVersion).toBe('0.1.3');

    const rec = await data<{ build: { version: string } }>(
      await POST(post({ action: 'record', projectPath: PROJECT_A, platform: 'Win64', status: 'success' })),
    );
    expect(rec.build.version).toBe(dash.nextVersion);
  });

  it('action=version is scoped the same way (pof_package_history reads it)', async () => {
    cook(PROJECT_A);
    cook(PROJECT_B);
    cook(PROJECT_B);
    const v = await data<{ version: string; nextVersion: string }>(await GET(get(`action=version&${qA}`)));
    expect(v.version).toBe('0.1.1');
    expect(v.nextVersion).toBe('0.1.2');
  });
});

describe('a smoke-condemned build burns its number', () => {
  it('condemning A\'s 0.1.3 keeps 0.1.3 on the row and the next green cook is 0.1.4', () => {
    cook(PROJECT_A);
    cook(PROJECT_A);
    const third = cook(PROJECT_A);
    expect(third.version).toBe('0.1.3');

    const att = attachSmokeResultToLatestBuild('Win64', 'Shipping', '[SMOKE] exe died', PROJECT_A, 'fail');
    expect(att.build?.id).toBe(third.buildId);
    expect(att.build?.status).toBe('failed');
    expect(getBuild(third.buildId)?.version).toBe('0.1.3');

    expect(cook(PROJECT_A).version).toBe('0.1.4');
  });
});

describe('[guard] the unscoped legacy counter is unchanged', () => {
  it('build_version 0.4.2 and no rows: an unattributed record takes 0.4.3 and advances the key', async () => {
    setSetting('build_version', '0.4.2');
    const rec = await data<{ build: { version: string } }>(
      await POST(post({ action: 'record', platform: 'Win64', status: 'success' })),
    );
    expect(rec.build.version).toBe('0.4.3');
    expect(getSetting('build_version')).toBe('0.4.3');
  });
});

describe('[guard] only a build recorded green is versioned', () => {
  it('failed, cancelled and smoke-failed outcomes stay unversioned and consume no number', () => {
    const deps = defaultRunnerDeps();
    const failed = finalizeCook({ kind: 'error', status: 'failed', message: 'x' }, ctx(PROJECT_A), deps);
    const cancelled = finalizeCook({ kind: 'error', status: 'cancelled', message: 'x' }, ctx(PROJECT_A), deps);
    const smoke = cook(PROJECT_A, { smoke: { failed: true, note: 'died' } });
    expect([failed.version, cancelled.version, smoke.version]).toEqual([null, null, null]);
    expect(cook(PROJECT_A).version).toBe('0.1.1');
  });
});
