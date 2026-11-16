/** A heartbeat for a task the registry does not hold is a 404, not a server fault. */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-psa-registry-${process.pid}.db`;
});

import { POST as registryPOST } from '@/app/api/cli-task-registry/route';

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('POST /api/cli-task-registry — heartbeat', () => {
  it('answers 404 for a task it does not hold', async () => {
    const res = await post(registryPOST, 'cli-task-registry', { action: 'heartbeat', taskId: 'nope' });
    expect(res.status).toBe(404);
  });
});
