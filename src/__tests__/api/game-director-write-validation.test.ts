/**
 * POST /api/game-director `add-finding` / `add-event` used to cast the body and hand it
 * to SQL: a bad severity tripped the table CHECK and a missing field a NOT NULL, both
 * answered as 500 with the raw SQLite message, and an unknown sessionId surfaced as a
 * FOREIGN KEY error. Now: malformed payloads are 400, an unknown session is 404.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-write-validation-${process.pid}.db`;
});

import { POST } from '@/app/api/game-director/route';
import { createSession, getEvents } from '@/lib/game-director-db';

const config = {
  testCategories: ['combat' as const],
  maxPlaytimeMinutes: 5,
  screenshotIntervalSeconds: 10,
  aggressiveMode: false,
  prioritySystems: [],
};
function post(body: unknown): Request {
  return new Request('http://localhost/api/game-director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const finding = (sessionId: string, over: Record<string, unknown> = {}) => ({
  id: `f-${Math.random().toString(36).slice(2)}`, sessionId, category: 'gameplay-feel', severity: 'high',
  title: 'T', description: '', relatedModule: null, screenshotRef: null, gameTimestamp: null,
  suggestedFix: '', confidence: null, ...over,
});
const event = (sessionId: string, over: Record<string, unknown> = {}) => ({
  id: `ev-${Math.random().toString(36).slice(2)}`, sessionId, timestamp: new Date().toISOString(),
  type: 'action', message: 'm', ...over,
});
function session(): string {
  const id = `gd-wv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  createSession(id, 'S', '', config, 'external');
  return id;
}

describe('game-director add-finding validation', () => {
  it('refuses an unknown severity with 400, not a SQLite 500', async () => {
    const res = await POST(post({ action: 'add-finding', finding: finding(session(), { severity: 'huge' }) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('huge');
  });
  it('refuses a missing finding and a missing id with 400', async () => {
    expect((await POST(post({ action: 'add-finding' }))).status).toBe(400);
    expect((await POST(post({ action: 'add-finding', finding: finding(session(), { id: '' }) }))).status).toBe(400);
  });
  it('answers a finding for a session that does not exist with 404', async () => {
    const res = await POST(post({ action: 'add-finding', finding: finding('gd-no-such-session') }));
    expect(res.status).toBe(404);
  });
  it('still stores a valid finding', async () => {
    const res = await POST(post({ action: 'add-finding', finding: finding(session()) }));
    expect(res.status).toBe(200);
  });
});

describe('game-director add-event validation', () => {
  it('refuses an unknown event type and a missing event with 400', async () => {
    expect((await POST(post({ action: 'add-event', event: event(session(), { type: 'weird' }) }))).status).toBe(400);
    expect((await POST(post({ action: 'add-event' }))).status).toBe(400);
  });
  it('answers an event for a missing session with 404', async () => {
    expect((await POST(post({ action: 'add-event', event: event('gd-no-such-session') }))).status).toBe(404);
  });
  it('still stores a valid event', async () => {
    const id = session();
    const res = await POST(post({ action: 'add-event', event: event(id) }));
    expect(res.status).toBe(200);
    expect(getEvents(id)).toHaveLength(1);
  });
});
