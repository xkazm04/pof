import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Real in-memory SQLite so the build ledger (headless_builds) is read exactly as written.
vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

// Only the UBT spawn is mocked; the queue and every ledger write are real.
const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));
vi.mock('@/lib/ue5-bridge/build-pipeline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ue5-bridge/build-pipeline')>()),
  executeBuild: executeMock,
}));

import { GET, POST } from '@/app/api/ue5-bridge/build/route';
import { buildQueue } from '@/lib/ue5-bridge/build-queue';
import { getDb } from '@/lib/db';
import { ensureHeadlessBuildsTable } from '@/lib/ue5-bridge/build-pipeline';
import type { BuildOptions, BuildRequest, BuildResult } from '@/types/ue5-bridge';

const REQ: BuildRequest = {
  projectPath: 'C:\\Proj', targetName: 'Did', ueVersion: '5.8.0',
  platform: 'Win64', configuration: 'Development', targetType: 'Editor',
};

const URL_BASE = 'http://localhost:3000/api/ue5-bridge/build';
const get = (buildId: string) => GET(new Request(`${URL_BASE}?buildId=${buildId}`) as unknown as NextRequest);
const post = (body: unknown) => POST(new Request(URL_BASE, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}) as unknown as NextRequest);

type Row = { status: string; started_at: string };
const rowOf = (id: string) =>
  getDb().prepare('SELECT status, started_at FROM headless_builds WHERE build_id = ?').get(id) as Row | undefined;

/** A mocked UBT run that stays open until released. */
function held() {
  let release: (r: Partial<BuildResult>) => void = () => {};
  const done = new Promise<Partial<BuildResult>>((res) => { release = res; });
  return { done, release: (r: Partial<BuildResult> = { status: 'success', errorCount: 0, warningCount: 0, durationMs: 1 }) => release(r) };
}

const drained = () => vi.waitFor(() => expect(buildQueue.getQueue()).toHaveLength(0));

beforeEach(() => {
  executeMock.mockReset();
  ensureHeadlessBuildsTable();
  getDb().exec('DELETE FROM headless_builds');
});
afterEach(async () => {
  vi.restoreAllMocks();
  await drained();
});

describe('GET /api/ue5-bridge/build?buildId answers every stage (ue5-build-bridge/A)', () => {
  it('a finished build is readable by id with its summary; an unknown id is still 404 (case 1)', async () => {
    executeMock.mockResolvedValue({ status: 'success', errorCount: 0, warningCount: 3, durationMs: 1234 });
    const id = buildQueue.enqueue(REQ);
    await vi.waitFor(() => expect(buildQueue.getStatus(id)).toBeNull());

    const res = await get(id);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ buildId: id, status: 'success', errorCount: 0, warningCount: 3, durationMs: 1234 });

    expect((await get('nope')).status).toBe(404);
  });

  it('a build aborted while queued reads aborted, not 404 (case 2)', async () => {
    const a = held();
    executeMock.mockImplementation(() => a.done);
    const idA = buildQueue.enqueue(REQ);
    const idB = buildQueue.enqueue(REQ);
    expect(buildQueue.abort(idB)).toBe(true);

    const res = await get(idB);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ buildId: idB, status: 'aborted' });

    a.release();
    await vi.waitFor(() => expect(buildQueue.getStatus(idA)).toBeNull());
  });

  it('the row precedes the spawn: queued at enqueue, running when executeBuild is invoked (case 3)', async () => {
    const a = held();
    const b = held();
    let rowAtSpawnB: Row | undefined;
    let idB = '';
    executeMock.mockImplementation((_req: BuildRequest, opts: BuildOptions) => {
      if (opts.buildId === idB) {
        rowAtSpawnB = rowOf(idB);
        return b.done;
      }
      return a.done;
    });

    buildQueue.enqueue(REQ);
    idB = buildQueue.enqueue(REQ);
    expect(rowOf(idB)?.status).toBe('queued');

    a.release();
    await vi.waitFor(() => expect(rowAtSpawnB).toBeDefined());
    expect(rowAtSpawnB?.status).toBe('running');
    expect(rowAtSpawnB?.started_at).toBeTruthy();

    b.release();
    await vi.waitFor(() => expect(buildQueue.getStatus(idB)).toBeNull());
  });

  it('a start whose record cannot be written is refused 500 and never spawns (case 4)', async () => {
    const db = getDb();
    const prepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (/INSERT/i.test(sql)) throw new Error('disk I/O error');
      return prepare(sql);
    }) as typeof db.prepare);

    const res = await post({ action: 'start', projectPath: 'C:\\Proj', targetName: 'Did', ueVersion: '5.8.0' });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/record/i);
    expect(executeMock).not.toHaveBeenCalled();
    expect(buildQueue.getQueue()).toHaveLength(0);
  });

  it('the status read is bounded: no output field, under 16 KB for a 256 KB log (case 7)', async () => {
    getDb().prepare(
      `INSERT INTO headless_builds (build_id, project_path, target_name, ue_version, platform, configuration,
         target_type, status, started_at, completed_at, duration_ms, exit_code, error_count, warning_count, output)
       VALUES ('build-big', 'C:\\Proj', 'Did', '5.8.0', 'Win64', 'Development', 'Editor', 'failed',
         '2026-09-29T10:00:00Z', '2026-09-29T10:05:00Z', 300000, 6, 2, 9, ?)`,
    ).run('x'.repeat(256 * 1024));

    const res = await get('build-big');
    expect(res.status).toBe(200);
    const text = await res.text();
    const json = JSON.parse(text);
    expect(json.data).toMatchObject({ buildId: 'build-big', status: 'failed', errorCount: 2 });
    expect(json.data).not.toHaveProperty('output');
    expect(text.length).toBeLessThan(16 * 1024);
  });
});
