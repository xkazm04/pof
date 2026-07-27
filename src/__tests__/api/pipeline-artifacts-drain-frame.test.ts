import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GET } from '@/app/api/pipeline-artifacts/drain/frame/route';
import { drainFrameUrl, drainFrameLabel } from '@/lib/test-gate-runner/frameUrl';

const req = (query: string) => new NextRequest(`http://localhost/api/pipeline-artifacts/drain/frame${query}`);

// A real PNG-ish file inside the capture jail (the OS temp dir), plus one outside it.
let framePath = '';
let outsideDir = '';
let outsidePath = '';

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof_l4_scn_test_'));
  framePath = path.join(dir, 'shot_02.png');
  fs.writeFileSync(framePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  outsideDir = fs.mkdtempSync(path.join(process.cwd(), 'pof-frame-jail-test-'));
  outsidePath = path.join(outsideDir, 'secret.png');
  fs.writeFileSync(outsidePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(() => {
  try { fs.rmSync(path.dirname(framePath), { recursive: true, force: true }); } catch { /* ignore */ }
  try { fs.rmSync(outsideDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('GET /api/pipeline-artifacts/drain/frame', () => {
  it('serves a captured frame from inside the capture jail as a PNG', async () => {
    const res = await GET(req(drainFrameUrl(framePath).replace('/api/pipeline-artifacts/drain/frame', '')));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect((await res.arrayBuffer()).byteLength).toBe(4);
  });

  it('refuses a path outside the capture directory (403 — never an arbitrary file read)', async () => {
    const res = await GET(req(`?path=${encodeURIComponent(outsidePath)}`));
    expect(res.status).toBe(403);
  });

  it('refuses a traversal attempt out of the temp jail', async () => {
    const escape = path.join(os.tmpdir(), '..', '..', 'Windows', 'system.ini.png');
    const res = await GET(req(`?path=${encodeURIComponent(escape)}`));
    expect([403, 404]).toContain(res.status);
  });

  it('refuses a non-png and a missing path with the standard envelope', async () => {
    const notPng = await GET(req(`?path=${encodeURIComponent(path.join(os.tmpdir(), 'x.txt'))}`));
    expect(notPng.status).toBe(400);
    expect(await notPng.json()).toMatchObject({ success: false });

    const missing = await GET(req(''));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ success: false });
  });

  it('404s a frame that no longer exists (a stale summary link never 500s)', async () => {
    const res = await GET(req(`?path=${encodeURIComponent(path.join(os.tmpdir(), 'pof_l4_gone', 'shot_00.png'))}`));
    expect(res.status).toBe(404);
  });
});

describe('drainFrameUrl / drainFrameLabel', () => {
  it('builds a relative, encoded URL', () => {
    expect(drainFrameUrl('/tmp/pof_l4_scn_1/shot_02.png'))
      .toBe('/api/pipeline-artifacts/drain/frame?path=%2Ftmp%2Fpof_l4_scn_1%2Fshot_02.png');
  });

  it('labels a frame with its directory so shot_02.png is not ambiguous across runs', () => {
    expect(drainFrameLabel('C:\\Temp\\pof_l4_scn_9\\shot_02.png')).toBe('pof_l4_scn_9/shot_02.png');
    expect(drainFrameLabel('shot_00.png')).toBe('shot_00.png');
  });
});
