/**
 * A POST body that is not a JSON object is the caller's mistake on every filesystem route:
 * 400, as the Blender bridge routes answer, not a SyntaxError or TypeError turned into a 500.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/file-watcher', () => ({
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
  subscribe: vi.fn(),
  getWatcherState: vi.fn(() => ({ subscriberCount: 0 })),
}));

import { POST as browse } from '@/app/api/filesystem/browse/route';
import { POST as scanAnimbp } from '@/app/api/filesystem/scan-animbp/route';
import { POST as scanAssets } from '@/app/api/filesystem/scan-assets/route';
import { POST as scanProject } from '@/app/api/filesystem/scan-project/route';
import { POST as verifySemantic } from '@/app/api/filesystem/verify-semantic/route';
import { POST as watch } from '@/app/api/filesystem/watch/route';

const ROUTES = Object.entries({ browse, scanAnimbp, scanAssets, scanProject, verifySemantic, watch });
const MALFORMED = ['{not json', 'null', '"x"', '[1,2]'];
const CASES = ROUTES.flatMap(([name, post]) => MALFORMED.map((body) => [name, body, post] as const));

describe('filesystem routes - malformed body', () => {
  it.each(CASES)('%s answers 400 for body %s', async (_name, body, post) => {
    const res = await post(new NextRequest('http://localhost/api/filesystem/x', { method: 'POST', body }));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });
});
