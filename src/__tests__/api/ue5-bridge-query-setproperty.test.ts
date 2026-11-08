/**
 * setProperty writes into the live editor. The connection manager is mocked, so no test
 * touches a real Remote Control server.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const client = { setProperty: vi.fn(async () => ({ ok: true, data: 1 })) };
vi.mock('@/lib/ue5-bridge/connection-manager', () => ({
  ue5Connection: { getClient: () => client, getState: () => ({ status: 'connected' }) },
}));

const { POST } = await import('@/app/api/ue5-bridge/query/route');

function req(body: unknown) {
  return new NextRequest('http://localhost:3001/api/ue5-bridge/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001' },
    body: JSON.stringify(body),
  });
}
const base = { action: 'setProperty', objectPath: '/Game/X', propertyName: 'Hp' };

describe('POST setProperty', () => {
  it('refuses a write with no value instead of sending an empty one', async () => {
    client.setProperty.mockClear();
    const res = await POST(req(base));
    expect(res.status).toBe(400);
    expect(client.setProperty).not.toHaveBeenCalled();
  });

  it.each([[0], [false], [''], [null]])('passes the falsy value %j through', async (value) => {
    client.setProperty.mockClear();
    const res = await POST(req({ ...base, value }));
    expect(res.status).toBe(200);
    expect(client.setProperty).toHaveBeenCalledWith('/Game/X', 'Hp', value);
  });
});
