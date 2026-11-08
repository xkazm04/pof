/**
 * ?action=restore-defaults overwrites every edited seed rule in bulk with no archive.
 * The three drift-review actions are behind requireOperator for exactly that reason;
 * this one was not, and a body-less POST needs no CORS preflight.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-rules-restore-guard-${process.pid}.db`;
});

const restore = vi.hoisted(() => vi.fn(() => ({ restored: 1, total: 1 })));
vi.mock('@/lib/project-rules-db', async (orig) => ({ ...(await orig<object>()), restoreCanonSeed: restore }));

import { POST } from '@/app/api/project-rules/route';

const call = (headers: Record<string, string>) =>
  POST(new NextRequest('http://localhost/api/project-rules?action=restore-defaults', { method: 'POST', headers }));

afterEach(() => { restore.mockClear(); });

describe('POST ?action=restore-defaults is operator-guarded', () => {
  it('refuses a cross-site request and restores nothing', async () => {
    const res = await call({ origin: 'https://evil.example', host: 'localhost' });
    expect(res.status).toBe(403);
    expect(restore).not.toHaveBeenCalled();
  });

  it('still restores for a same-origin request', async () => {
    const res = await call({ origin: 'http://localhost', host: 'localhost' });
    expect(res.status).toBe(200);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
