/**
 * Snapshot ids were `snap-${Date.now()}` into a plain INSERT on a TEXT PRIMARY KEY, so two scans
 * inside one millisecond (double click, two tabs) answered 500 on the UNIQUE constraint.
 * Throwaway DB via POF_DB_PATH; Date.now is frozen for the whole test.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-telemetry-same-ms-${process.pid}.db`;
});

import { POST } from '@/app/api/telemetry/route';
import { getSnapshotHistory } from '@/lib/telemetry-db';

const PROJECT = 'C:/telemetry-same-ms';
const scan = () =>
  POST(new NextRequest('http://localhost/api/telemetry', {
    method: 'POST',
    body: JSON.stringify({ action: 'scan', projectPath: PROJECT, dynamicContext: null }),
  }));

afterEach(() => { vi.restoreAllMocks(); });

describe('telemetry scan', () => {
  it('two scans in one millisecond both land', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const first = await scan();
    const second = await scan();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const ids = getSnapshotHistory(10, PROJECT).map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});
