/**
 * POST /api/gdd-compliance used to pass projectPath / gapId / moduleId / note to the
 * resolution store untyped, so `gapId: 5` or `projectPath: {}` became a scope key no
 * reader asks for (or a SQLite bind error). Non-strings are now the caller's 400.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { resolveGap, unresolveGap, listResolutions } = vi.hoisted(() => ({
  resolveGap: vi.fn(), unresolveGap: vi.fn(), listResolutions: vi.fn(),
}));
vi.mock('@/lib/gdd-compliance', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  resolveGap, unresolveGap, listResolutions,
}));

import { POST } from '@/app/api/gdd-compliance/route';

beforeEach(() => {
  vi.clearAllMocks();
  resolveGap.mockReturnValue({ ok: true });
  unresolveGap.mockReturnValue(true);
  listResolutions.mockReturnValue([]);
});

function post(body: unknown): Request {
  return new Request('http://localhost/api/gdd-compliance', { method: 'POST', body: JSON.stringify(body) });
}

describe('gdd-compliance field types', () => {
  it('refuses a numeric gapId and an object projectPath with 400 and writes nothing', async () => {
    expect((await POST(post({ action: 'resolve-gap', gapId: 5, projectPath: '/p' }))).status).toBe(400);
    expect((await POST(post({ action: 'resolve-gap', gapId: 'g', projectPath: {} }))).status).toBe(400);
    expect((await POST(post({ action: 'unresolve-gap', gapId: 5 }))).status).toBe(400);
    expect((await POST(post({ action: 'resolutions', projectPath: 7 }))).status).toBe(400);
    expect(resolveGap).not.toHaveBeenCalled();
    expect(unresolveGap).not.toHaveBeenCalled();
    expect(listResolutions).not.toHaveBeenCalled();
  });
  it('refuses a non-string moduleId or note', async () => {
    expect((await POST(post({ action: 'resolve-gap', gapId: 'g', moduleId: 1 }))).status).toBe(400);
    expect((await POST(post({ action: 'resolve-gap', gapId: 'g', note: {} }))).status).toBe(400);
    expect(resolveGap).not.toHaveBeenCalled();
  });
  it('still resolves with string fields and with projectPath absent', async () => {
    expect((await POST(post({ action: 'resolve-gap', gapId: 'g', projectPath: '/p', moduleId: 'm', note: 'n' }))).status).toBe(200);
    expect((await POST(post({ action: 'resolve-gap', gapId: 'g' }))).status).toBe(200);
    expect(resolveGap).toHaveBeenCalledTimes(2);
    expect(resolveGap.mock.calls[1][0]).toBe('');
  });
});
