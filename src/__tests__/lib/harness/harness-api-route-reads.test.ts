/**
 * GET /api/harness — the READ side of the control surface.
 *
 * (a) `?action=progress` must honour the state-io contract: a MISSING log is an
 *     honest `[]` (first run), a CORRUPT log is an error naming the file — never
 *     `[]`, which would tell the UI / `pof_harness_status` that nothing ever ran.
 * (b) `?statePath=` (or the last config's statePath when no in-memory run exists)
 *     serves the status snapshot from the durable sidecars on disk, so a status
 *     read after a server restart reports the resumable run instead of `idle`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { NextRequest } from 'next/server';

const getRunMock = vi.fn((_id: string): { status: string } | null => null);
vi.mock('@/lib/harness-runs-db', () => ({
  reapStrandedRuns: vi.fn(() => 0),
  getRun: (id: string) => getRunMock(id),
}));

import { GET } from '@/app/api/harness/route';

type G = { harnessConfig?: { statePath: string } | undefined; harnessOrchestrator?: unknown; harnessStatus?: string; harnessEvents?: unknown[] };
const g = globalThis as unknown as G;

function getReq(query: Record<string, string> = {}): NextRequest {
  const sp = new URLSearchParams(query);
  return { nextUrl: { searchParams: sp } } as unknown as NextRequest;
}

const dirs: string[] = [];
function tmpState(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-state-'));
  dirs.push(d);
  return d;
}

beforeEach(() => {
  g.harnessOrchestrator = undefined;
  g.harnessConfig = undefined;
  g.harnessStatus = 'idle';
  g.harnessEvents = [];
  getRunMock.mockReset();
  getRunMock.mockReturnValue(null);
});
afterEach(() => {
  for (const d of dirs.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

describe('GET /api/harness?action=progress — corrupt is never an empty log', () => {
  it('a missing progress.json is an honest empty log', async () => {
    g.harnessConfig = { statePath: tmpState() };
    const res = await GET(getReq({ action: 'progress' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it('a parseable progress.json is returned as-is', async () => {
    const sp = tmpState();
    fs.writeFileSync(path.join(sp, 'progress.json'), JSON.stringify([{ iteration: 1, areaId: 'a' }]));
    g.harnessConfig = { statePath: sp };
    const res = await GET(getReq({ action: 'progress' }));
    expect((await res.json()).data).toEqual([{ iteration: 1, areaId: 'a' }]);
  });

  it('a CORRUPT progress.json is an error naming the file, never []', async () => {
    const sp = tmpState();
    fs.writeFileSync(path.join(sp, 'progress.json'), '[{"iteration": 1, "areaId": "a"'); // truncated write
    g.harnessConfig = { statePath: sp };
    const res = await GET(getReq({ action: 'progress' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/CORRUPT/);
    expect(body.error).toContain('progress.json');
  });
});
