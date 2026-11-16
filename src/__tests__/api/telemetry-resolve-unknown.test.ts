/**
 * Resolving a suggestion id no row owns updated nothing and answered { ok: true }, so the
 * panel showed an accept that was never recorded.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-telemetry-resolve-${process.pid}.db`;
});

import { POST } from '@/app/api/telemetry/route';
import { saveSuggestion, getAllSuggestions } from '@/lib/telemetry-db';

const resolve = (suggestionId: unknown) =>
  POST(new NextRequest('http://localhost/api/telemetry', { method: 'POST', body: JSON.stringify({ action: 'resolve', suggestionId, resolveAction: 'accept' }) }));

describe('telemetry resolve', () => {
  it('an unknown suggestion id -> 404', async () => {
    const res = await resolve('nope');
    expect(res.status).toBe(404);
  });

  it('a non-string id -> 400', async () => {
    expect((await resolve({})).status).toBe(400);
  });

  it('a real suggestion resolves', async () => {
    const seeded = { id: 'sg-1', subGenre: 'soulslike', label: 'L', description: 'D', confidence: 0.5, patterns: [], proposedChanges: [], status: 'pending', createdAt: new Date().toISOString(), resolvedAt: null };
    saveSuggestion(seeded as unknown as Parameters<typeof saveSuggestion>[0]);
    expect((await resolve('sg-1')).status).toBe(200);
    expect(getAllSuggestions(10).find((s) => s.id === 'sg-1')?.status).toBe('accepted');
  });
});
