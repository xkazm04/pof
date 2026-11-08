/**
 * POST /api/project-health refuses a malformed request with 400 and a reason
 * instead of letting it surface as a 500 "Health computation failed".
 *
 * The body was cast field by field with no check: unparseable JSON, a `null`
 * body or `scanHistory: "x"` all threw inside the handler and reported a server
 * fault for a caller mistake.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/project-health/route';

function req(raw: string): NextRequest {
  return new NextRequest('http://localhost/api/project-health', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
}

async function call(raw: string) {
  const res = await POST(req(raw));
  return { status: res.status, body: (await res.json()) as { success: boolean; error?: string } };
}

describe('POST /api/project-health — input validation', () => {
  it.each([
    ['unparseable JSON', '{not json'],
    ['a null body', 'null'],
    ['an array body', '[]'],
    ['scanHistory that is not an array', JSON.stringify({ scanHistory: 'x' })],
    ['checklistProgress that is not an object', JSON.stringify({ checklistProgress: [1, 2] })],
    ['lastScan that is not an object', JSON.stringify({ lastScan: 7 })],
    ['completionLedger that is not an object', JSON.stringify({ completionLedger: 'x' })],
  ])('%s -> 400', async (_label, raw) => {
    const { status, body } = await call(raw);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it('an empty object still computes (every field is optional)', async () => {
    const { status, body } = await call('{}');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
