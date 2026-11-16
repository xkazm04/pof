/**
 * Every WRITE handler (POST/PUT/PATCH/DELETE) of the catalog→UE control plane runs
 * `requireOperator` before it reads its body — `src/lib/api-auth.ts` names this plane
 * (artifact writes, drains, lifecycle) as privileged, and an unguarded write is reachable
 * by a drive-by cross-site POST (`text/plain` bodies need no preflight and `req.json()`
 * parses them anyway).
 *
 * The route set is ENUMERATED FROM THE FILESYSTEM, not from a list: a new write route under
 * these trees is guarded or it fails here. The exemptions are the routes whose consumers are
 * header-less agents that cannot present a token yet (pof-mcp's client sends none), each with
 * its reason — guarding them is a separate change (the client must carry the token first).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';

const ROOTS = ['catalog', 'catalog-entities', 'pipeline', 'pipeline-artifacts'].map((r) => path.join(process.cwd(), 'src/app/api', r));

/** Write routes deliberately NOT guarded yet — key: path under src/app/api. */
const EXEMPT: Record<string, string> = {};

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name === 'route.ts' ? [p] : [];
  });
}

/** Strip comments first, so a file that only TALKS about the guard does not pass. */
function code(file: string): string {
  return fs.readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const WRITE_HANDLER = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\s*\(/g;

/** Each write handler's body text, up to the next exported function. */
function writeHandlers(src: string): { method: string; body: string }[] {
  const out: { method: string; body: string }[] = [];
  for (const m of src.matchAll(WRITE_HANDLER)) {
    const start = m.index ?? 0;
    const next = src.slice(start + m[0].length).search(/export\s+(?:async\s+)?function\s/);
    out.push({ method: m[1], body: next < 0 ? src.slice(start) : src.slice(start, start + m[0].length + next) });
  }
  return out;
}

describe('catalog→UE write routes are operator-guarded', () => {
  const files = ROOTS.flatMap(walk);
  const rel = (f: string) => path.relative(path.join(process.cwd(), 'src/app/api'), f).split(path.sep).join('/');

  it('enumerates the real route tree', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it('every write handler calls requireOperator before it reads the body', () => {
    const unguarded: string[] = [];
    for (const f of files) {
      if (EXEMPT[rel(f)]) continue;
      for (const h of writeHandlers(code(f))) {
        const guard = h.body.indexOf('requireOperator(');
        const read = h.body.search(/req(?:uest)?\.(?:json|text|formData)\(|readSweepBody\(/);
        if (guard < 0 || (read >= 0 && read < guard)) unguarded.push(`${rel(f)} ${h.method}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it('every exemption still names a real, still-unguarded write route (no stale entries)', () => {
    for (const key of Object.keys(EXEMPT)) {
      const f = files.find((x) => rel(x) === key);
      expect(f, key).toBeDefined();
      const handlers = writeHandlers(code(f!));
      expect(handlers.length, key).toBeGreaterThan(0);
      expect(handlers.some((h) => !h.body.includes('requireOperator(')), key).toBe(true);
    }
  });
});

// ── Behaviour: a cross-site POST is refused before any sweep runs ───────────────
const { sweep } = vi.hoisted(() => ({ sweep: vi.fn<(filter: unknown) => { results: never[] }>(() => ({ results: [] })) }));
vi.mock('@/lib/catalog/pipelines/registry.generated', () => ({}));
vi.mock('@/lib/catalog/acceptance/bindIconsAll', () => ({ bindIconsAll: sweep }));
vi.mock('@/lib/catalog/acceptance/bindIconsDeps', () => ({ listIconLibrary: () => [], makeBindIconsDeps: () => ({ flushLifecycle: () => {} }) }));
vi.mock('@/lib/catalog/acceptance/staticVerify', () => ({ verifyStaticAll: sweep, defaultStaticVerifyDeps: {} }));
vi.mock('@/lib/catalog/acceptance/packagingVerify', () => ({ verifyPackagingAll: sweep, defaultPackagingVerifyDeps: () => ({}) }));

import { POST as bindIconsPOST } from '@/app/api/pipeline-artifacts/bind-icons/route';
import { POST as verifyStaticPOST } from '@/app/api/pipeline-artifacts/verify-static/route';
import { POST as verifyPackagingPOST } from '@/app/api/pipeline-artifacts/verify-packaging/route';

describe.each([
  { name: 'bind-icons', post: bindIconsPOST },
  { name: 'verify-static', post: verifyStaticPOST },
  { name: 'verify-packaging', post: verifyPackagingPOST },
])('POST /api/pipeline-artifacts/$name — cross-site', ({ name, post }) => {
  let saved: string | undefined;
  beforeEach(() => { saved = process.env.POF_OPERATOR_TOKEN; delete process.env.POF_OPERATOR_TOKEN; sweep.mockClear(); });
  afterEach(() => { if (saved !== undefined) process.env.POF_OPERATOR_TOKEN = saved; });

  const req = (headers: Record<string, string>) => new NextRequest(`http://localhost:3001/api/pipeline-artifacts/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain', host: 'localhost:3001', ...headers }, body: '{}',
  });

  it('403s a cross-origin browser POST and runs nothing', async () => {
    expect((await post(req({ origin: 'http://evil.test' }))).status).toBe(403);
    expect(sweep).not.toHaveBeenCalled();
  });

  it('still serves a same-origin POST', async () => {
    expect((await post(req({ origin: 'http://localhost:3001' }))).status).toBe(200);
    expect(sweep).toHaveBeenCalledTimes(1);
  });
});
