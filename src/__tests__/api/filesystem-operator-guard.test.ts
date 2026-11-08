/**
 * The filesystem POST routes walk and read the local disk. `request.json()` ignores the
 * content type, so a cross-site text/plain form post reached them, and on a deployment with
 * POF_OPERATOR_TOKEN set they answered anyone without it.
 */
import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as browse } from '@/app/api/filesystem/browse/route';
import { POST as scanAnimbp } from '@/app/api/filesystem/scan-animbp/route';
import { POST as scanAssets } from '@/app/api/filesystem/scan-assets/route';
import { POST as scanProject } from '@/app/api/filesystem/scan-project/route';
import { POST as verifySemantic } from '@/app/api/filesystem/verify-semantic/route';

const root = mkdtempSync(join(tmpdir(), 'pof-fs-guard-'));
const ROUTES = [
  ['browse', browse, { action: 'validate-path', path: root }],
  ['scan-animbp', scanAnimbp, { projectPath: root, moduleName: 'M' }],
  ['scan-assets', scanAssets, { projectPath: root }],
  ['scan-project', scanProject, { projectPath: root }],
  ['verify-semantic', verifySemantic, { projectPath: root, items: [{ moduleId: 'm', itemId: 'i' }] }],
] as const;

const req = (body: unknown, headers: Record<string, string>) =>
  new NextRequest('http://localhost:3001/api/filesystem/x', {
    method: 'POST',
    headers: { host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });

afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe.each(ROUTES)('filesystem/%s operator guard', (_name, post, body) => {
  it('refuses a cross-site browser request', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    const res = await post(req(body, { origin: 'https://evil.example', 'content-type': 'text/plain' }));
    expect(res.status).toBe(403);
  });

  it('refuses a missing token when one is configured', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', 'secret');
    expect((await post(req(body, {}))).status).toBe(401);
  });

  it('[guard] the same-origin UI still reaches it', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    expect((await post(req(body, { origin: 'http://localhost:3001' }))).status).toBe(200);
  });

  it('[guard] a header-less server-to-server call still reaches it', async () => {
    vi.stubEnv('POF_OPERATOR_TOKEN', '');
    expect((await post(req(body, {}))).status).toBe(200);
  });
});
