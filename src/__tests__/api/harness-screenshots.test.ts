import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-harness-shots-'));
  fs.mkdirSync(path.join(tmp, 'screenshots'), { recursive: true });
});

afterEach(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
  // Wipe any leakage from globalThis we may have set.
  delete (globalThis as unknown as { harnessConfig?: unknown }).harnessConfig;
});

import { GET as listGET } from '@/app/api/harness/screenshots/route';
import { GET as imgGET } from '@/app/api/harness/screenshot/route';

function listReq(statePath: string) {
  return new NextRequest(`http://localhost/api/harness/screenshots?statePath=${encodeURIComponent(statePath)}`);
}
function imgReq(statePath: string, iter: string, slug: string, kind = 'screenshot') {
  const q = new URLSearchParams({ statePath, iter, slug, kind });
  return new NextRequest(`http://localhost/api/harness/screenshot?${q}`);
}

describe('GET /api/harness/screenshots', () => {
  it('returns empty iterations when no screenshots exist yet', async () => {
    const res = await listGET(listReq(tmp));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.iterations).toEqual([]);
    expect(body.data.baselineSlugs).toEqual([]);
  });

  it('returns 404 when no statePath is configured or supplied', async () => {
    const res = await listGET(new NextRequest('http://localhost/api/harness/screenshots'));
    expect(res.status).toBe(404);
  });

  it('enumerates iterations newest-first with their parsed module results', async () => {
    fs.mkdirSync(path.join(tmp, 'screenshots', '1'));
    fs.writeFileSync(path.join(tmp, 'screenshots', '1', 'result.json'), JSON.stringify({
      passed: true, modulesChecked: 1, errors: [], screenshots: [],
      modules: [{ slug: 'items', label: 'Items', status: 'pass', screenshot: '', changePct: null, diffPath: null, a11yViolations: 0, errors: [] }],
      a11yViolations: 0,
    }));
    fs.mkdirSync(path.join(tmp, 'screenshots', '3'));
    fs.writeFileSync(path.join(tmp, 'screenshots', '3', 'result.json'), JSON.stringify({
      passed: false, modulesChecked: 1, errors: ['x'], screenshots: [],
      modules: [{ slug: 'items', label: 'Items', status: 'fail', screenshot: '', changePct: 0.5, diffPath: '/a.diff.png', a11yViolations: 2, errors: ['VISUAL_REGRESSION'] }],
      a11yViolations: 2,
    }));
    fs.mkdirSync(path.join(tmp, 'screenshots', 'baseline'));
    fs.writeFileSync(path.join(tmp, 'screenshots', 'baseline', 'items.png'), 'x');

    const res = await listGET(listReq(tmp));
    const body = await res.json();
    expect(body.data.iterations.map((i: { iteration: number }) => i.iteration)).toEqual([3, 1]);
    expect(body.data.iterations[0].modules[0].status).toBe('fail');
    expect(body.data.baselineSlugs).toEqual(['items']);
  });
});

describe('GET /api/harness/screenshot', () => {
  it('serves a PNG buffer for a valid iter+slug', async () => {
    const dir = path.join(tmp, 'screenshots', '5');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'items.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const res = await imgGET(imgReq(tmp, '5', 'items'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('returns 400 for an invalid slug (path-traversal guard)', async () => {
    const res = await imgGET(imgReq(tmp, '1', '../../etc/passwd'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid iter', async () => {
    const res = await imgGET(imgReq(tmp, 'not-a-number', 'items'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the file is missing', async () => {
    const res = await imgGET(imgReq(tmp, '99', 'items'));
    expect(res.status).toBe(404);
  });

  it('serves diff overlays when kind=diff', async () => {
    const dir = path.join(tmp, 'screenshots', '7');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'items.diff.png'), 'x');
    const res = await imgGET(imgReq(tmp, '7', 'items', 'diff'));
    expect(res.status).toBe(200);
  });
});

describe('visual-modules manifest', () => {
  it('uses the same testid pattern the catalog tree applies', async () => {
    const { HARNESS_CATALOG_TESTID, VISUAL_GATE_MODULES } = await import('@/lib/harness/visual-modules');
    // The Catalog tree renders `data-testid={\`harness-catalog-${catalogId}\`}` — the helper must match.
    expect(HARNESS_CATALOG_TESTID('items')).toBe('harness-catalog-items');
    expect(VISUAL_GATE_MODULES.length).toBeGreaterThan(0);
    expect(VISUAL_GATE_MODULES.every((m) => m.slug && m.label)).toBe(true);
  });
});
