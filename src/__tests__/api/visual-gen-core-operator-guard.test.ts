/**
 * The paid and process-spawning POST routes of visual-gen-core. Each spends provider credit
 * (generate, generate-2d, contact-sheet, input-gate, footage-gate) or starts Blender
 * (icon-from-mesh), and `request.json()` ignores the content type, so a cross-site
 * text/plain form post reached every one of them. Nothing here calls a provider: an empty
 * body is refused by each handler after the guard.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/visual-gen/image-providers', async (orig) => ({
  ...(await orig<typeof import('@/lib/visual-gen/image-providers')>()),
  generateTwoDImage: vi.fn(async () => ({ ok: false, refused: true, error: 'stubbed' })),
}));
vi.mock('@/lib/db', () => ({ getDb: () => { throw new Error('the DB must not open'); } }));

const ROUTES = [
  ['generate', (await import('@/app/api/visual-gen/generate/route')).POST],
  ['generate-2d', (await import('@/app/api/visual-gen/generate-2d/route')).POST],
  ['contact-sheet', (await import('@/app/api/visual-gen/contact-sheet/route')).POST],
  ['icon-from-mesh', (await import('@/app/api/visual-gen/icon-from-mesh/route')).POST],
  ['input-gate', (await import('@/app/api/visual-gen/input-gate/route')).POST],
  ['footage-gate', (await import('@/app/api/visual-gen/footage-gate/route')).POST],
] as const;

const req = (headers: Record<string, string>) =>
  new NextRequest('http://localhost:3001/api/visual-gen/x', {
    method: 'POST',
    headers: { host: 'localhost:3001', ...headers },
    body: '{}',
  });

afterEach(() => vi.unstubAllEnvs());

describe.each(ROUTES)('visual-gen/%s operator guard', (_name, post) => {
  it('refuses a cross-site browser request', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    expect((await post(req({ origin: 'https://evil.example', 'content-type': 'text/plain' }))).status).toBe(403);
  });

  it('refuses a missing token when one is configured', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', 'secret');
    expect((await post(req({}))).status).toBe(401);
  });

  it('[guard] the same-origin UI still reaches the handler', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    expect((await post(req({ origin: 'http://localhost:3001' }))).status).toBe(400);
  });

  it('[guard] a header-less server-to-server call still reaches the handler', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    expect((await post(req({}))).status).toBe(400);
  });
});
