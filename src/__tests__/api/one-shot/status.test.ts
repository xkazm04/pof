import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/one-shot/status/[executionId]/route';

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  getExecutionStatus: vi.fn().mockImplementation((id: string) => {
    if (id === 'exec-known') return { state: 'completed', lastEvent: undefined };
    return null;
  }),
}));

afterEach(() => { vi.restoreAllMocks(); });

function makeGet(executionId: string): NextRequest {
  return new NextRequest(`http://localhost/api/one-shot/status/${executionId}`);
}

function makeParams(executionId: string): { params: Promise<{ executionId: string }> } {
  return { params: Promise.resolve({ executionId }) };
}

describe('GET /api/one-shot/status/:executionId', () => {
  it('returns 404 for unknown executionId', async () => {
    const res = await GET(makeGet('exec-unknown'), makeParams('exec-unknown'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns the status for a known executionId', async () => {
    const res = await GET(makeGet('exec-known'), makeParams('exec-known'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.state).toBe('completed');
  });
});
