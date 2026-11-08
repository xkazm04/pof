/**
 * POST /api/game-director `update-status` is part of the external writer seam (a real
 * harness drives a session through configuring → … → complete). It used to pass the
 * client's `status` straight to SQL: an unknown value tripped the table's CHECK and came
 * back as a 500 carrying the raw SQLite message, and a `sessionId` that names no session
 * answered `{ ok: true }` over an UPDATE that touched nothing.
 *
 * Now: an unknown status is the caller's error (400, naming the value), and a missing
 * session is a 404 — the same refusal `simulate` already gives.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-update-status-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import { createSession, getSession } from '@/lib/game-director-db';

function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const config = {
  testCategories: ['combat' as const],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

describe('game-director update-status', () => {
  it('refuses an unknown status with 400 and leaves the session unchanged', async () => {
    const id = `gd-us-${Date.now()}-a`;
    createSession(id, 'S', '', config, 'external');
    const res = await POST(post({ action: 'update-status', sessionId: id, status: 'exploded' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('exploded');
    expect(getSession(id)?.status).toBe('configuring');
  });

  it('answers a sessionId that names no session with 404', async () => {
    const res = await POST(post({ action: 'update-status', sessionId: 'gd-does-not-exist', status: 'playing' }));
    expect(res.status).toBe(404);
  });

  it('refuses a missing sessionId with 400', async () => {
    const res = await POST(post({ action: 'update-status', status: 'playing' }));
    expect(res.status).toBe(400);
  });

  it('still moves a real session to a known status', async () => {
    const id = `gd-us-${Date.now()}-b`;
    createSession(id, 'S', '', config, 'external');
    const res = await POST(post({ action: 'update-status', sessionId: id, status: 'playing' }));
    expect(res.status).toBe(200);
    expect(getSession(id)?.status).toBe('playing');
  });
});
