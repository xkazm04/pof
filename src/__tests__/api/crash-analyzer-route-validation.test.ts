/**
 * `/api/crash-analyzer` POST — malformed input is the CLIENT's fault (400), not
 * a server crash (500).
 *
 * The handler used to `await req.json()` and read `body.action` / `rawText.split`
 * with no shape check, so invalid JSON, a `null` body or a non-string `rawText`
 * all surfaced as `500 Crash analyzer error: …` — a server fault reported for a
 * bad request, which also hides real 500s in the noise.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const recordCrashSighting = vi.fn();
vi.mock('@/lib/crash-history-db', () => ({
  listCrashHistory: () => [],
  recordCrashSighting: (...a: unknown[]) => recordCrashSighting(...a),
}));

import { POST } from '@/app/api/crash-analyzer/route';

function rawPost(body: string) {
  return POST(new NextRequest('http://localhost/api/crash-analyzer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }));
}

describe('crash-analyzer POST — malformed bodies are 400', () => {
  it.each([
    ['invalid JSON', '{not json'],
    ['null body', 'null'],
    ['array body', '[]'],
    ['non-string rawText', JSON.stringify({ action: 'parse-log', rawText: 123 })],
    ['object rawText', JSON.stringify({ action: 'parse-log', rawText: { a: 1 } })],
    ['non-string crashId', JSON.stringify({ action: 'analyze', crashId: 7 })],
  ])('%s → 400', async (_label, body) => {
    const res = await rawPost(body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(recordCrashSighting).not.toHaveBeenCalled();
  });

  it('unknown action stays 400', async () => {
    const res = await rawPost(JSON.stringify({ action: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('full-analysis still answers 200', async () => {
    const res = await rawPost(JSON.stringify({ action: 'full-analysis' }));
    expect(res.status).toBe(200);
  });
});
