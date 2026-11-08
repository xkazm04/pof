/**
 * /api/search and /api/project-wrapped had no error boundary: a thrown DB error left the
 * route as a bare framework 500 that apiFetch cannot unwrap, instead of the API envelope.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/search-index', () => ({
  searchIndex: () => { throw new Error('fts down'); },
  rebuildSearchIndex: () => { throw new Error('fts down'); },
  getLastRebuildTime: () => null,
}));
vi.mock('@/lib/project-wrapped', () => ({ generateProjectWrapped: () => { throw new Error('db down'); } }));

import { GET as searchGET } from '@/app/api/search/route';
import { GET as wrappedGET } from '@/app/api/project-wrapped/route';

async function expectEnvelope(res: Response) {
  expect(res.status).toBe(500);
  const body = (await res.json()) as { success: boolean; error?: string };
  expect(body.success).toBe(false);
  expect(body.error).toBeTruthy();
}

describe('project-ops read routes answer failures in the envelope', () => {
  it('search query', async () => { await expectEnvelope(await searchGET(new NextRequest('http://localhost/api/search?q=x'))); });
  it('search rebuild', async () => { await expectEnvelope(await searchGET(new NextRequest('http://localhost/api/search?rebuild=1'))); });
  it('project-wrapped', async () => { await expectEnvelope(await wrappedGET()); });
});
