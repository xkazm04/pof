import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Real in-memory SQLite so the rebuild lookup reads headless_builds as written.
vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

const { enqueueMock } = vi.hoisted(() => ({ enqueueMock: vi.fn() }));
vi.mock('@/lib/ue5-bridge/build-queue', () => ({
  buildQueue: { enqueue: enqueueMock, abort: vi.fn(), getStatus: vi.fn(), getQueue: vi.fn(() => []) },
}));

import { POST } from '@/app/api/ue5-bridge/build/route';
import { getDb } from '@/lib/db';
import { ensureHeadlessBuildsTable } from '@/lib/ue5-bridge/build-pipeline';

function post(body: unknown): NextRequest {
  return new Request('http://localhost:3000/api/ue5-bridge/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  enqueueMock.mockReset();
  enqueueMock.mockReturnValue('build-2-new');
  ensureHeadlessBuildsTable();
  getDb().exec('DELETE FROM headless_builds');
  getDb()
    .prepare(
      `INSERT INTO headless_builds (build_id, project_path, target_name, ue_version, platform, configuration,
         target_type, status, started_at, duration_ms, error_count, warning_count)
       VALUES ('build-1-abc', 'C:\\Proj', 'Did', '5.8.0', 'Win64', 'Shipping', 'Game', 'success', '2026-09-28T10:00:00Z', 1000, 0, 0)`,
    )
    .run();
});

describe('POST /api/ue5-bridge/build { action: rebuild }', () => {
  it('re-enqueues the identical lane from the recorded build and returns a NEW id (case 3)', async () => {
    const res = await POST(post({ action: 'rebuild', buildId: 'build-1-abc' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, data: { buildId: 'build-2-new' } });
    expect(json.data.buildId).not.toBe('build-1-abc');
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][0]).toEqual({
      projectPath: 'C:\\Proj',
      targetName: 'Did',
      targetType: 'Game',
      configuration: 'Shipping',
      platform: 'Win64',
      ueVersion: '5.8.0',
    });
  });

  it('404s naming the id when no build was recorded under it, and enqueues nothing (case 4)', async () => {
    const res = await POST(post({ action: 'rebuild', buildId: 'build-unknown' }));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toContain('build-unknown');
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('[guard] a start with targetName "Did;calc" is still rejected 400 (case 8)', async () => {
    const res = await POST(post({ action: 'start', projectPath: 'C:\\Proj', targetName: 'Did;calc', ueVersion: '5.8.0' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/targetName/);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
