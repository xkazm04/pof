import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/pipeline-artifacts/drain/status/route';
import { acquireLeases, __resetLeases } from '@/lib/test-gate-runner/drain-lease';

describe('GET /api/pipeline-artifacts/drain/status', () => {
  beforeEach(() => __resetLeases());

  it('returns an idle lease state (envelope success) when nothing is draining', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.held).toBe(false);
    expect(body.data.scope).toBeNull();
  });

  it('reflects a held lease read from the shared registry', async () => {
    acquireLeases(['items|item-1']);
    const res = GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.held).toBe(true);
    expect(body.data.scope).toBe('items/item-1');
    expect(body.data.scopes).toEqual(['items/item-1']);
  });
});
