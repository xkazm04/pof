/**
 * POST /api/game-director is the external writer seam (sessions stamped `external`,
 * findings routed into the feature matrix) and DELETE removes sessions, so both are
 * operator-guarded like every other source-of-record write: a cross-site browser
 * request is refused (403) and, when POF_OPERATOR_TOKEN is set, a token-less call is
 * refused (401). Header-less server-to-server calls and same-origin calls pass.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-operator-guard-${process.pid}.db`;
});

import { POST, DELETE } from '@/app/api/game-director/route';
import { createSession, getSession } from '@/lib/game-director-db';

const savedToken = process.env.POF_OPERATOR_TOKEN;
beforeEach(() => { delete process.env.POF_OPERATOR_TOKEN; });
afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

const config = {
  testCategories: ['combat' as const],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3001/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });
}
function del(id: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3001/api/game-director?sessionId=${id}`, {
    method: 'DELETE',
    headers: { host: 'localhost:3001', ...headers },
  });
}

describe('game-director operator guard', () => {
  it('refuses a cross-site create with 403', async () => {
    const res = await POST(post({ action: 'create', name: 'X', buildPath: '', config }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });
  it('refuses a token-less POST with 401 when a token is set', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await POST(post({ action: 'create', name: 'X', buildPath: '', config }));
    expect(res.status).toBe(401);
  });
  it('still creates for a same-origin POST', async () => {
    const res = await POST(post({ action: 'create', name: 'X', buildPath: '', config }, { origin: 'http://localhost:3001' }));
    expect(res.status).toBe(200);
  });
  it('refuses a cross-site DELETE with 403 and keeps the session', async () => {
    const id = `gd-og-${Date.now()}-a`;
    createSession(id, 'S', '', config, 'external');
    const res = await DELETE(del(id, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(getSession(id)).toBeTruthy();
  });
  it('still deletes on a same-origin DELETE', async () => {
    const id = `gd-og-${Date.now()}-b`;
    createSession(id, 'S', '', config, 'external');
    const res = await DELETE(del(id, { origin: 'http://localhost:3001' }));
    expect(res.status).toBe(200);
    expect(getSession(id)).toBeFalsy();
  });
});
