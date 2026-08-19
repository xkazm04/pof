/**
 * `POST /api/blender-mcp { action:'status' }` is the ONE call the whole app's
 * connection state derives from — the pill, the wizard banner and 19 Produce
 * gates. At HEAD~1 it was `apiSuccess({ connection: svc.getStatus() })`, i.e. a
 * copy of a field, so this route happily reported a live bridge against an
 * addon that had stopped answering. Both assertions below are red there.
 *
 * This runs the REAL route against the REAL service over a real TCP socket
 * (`createMockBlenderServer`); nothing is mocked, because the whole defect was
 * that the route never touched the wire.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createMockBlenderServer,
  SCENE_OK,
  type MockBlenderServer,
} from '../lib/blender-mcp/mockBlenderServer';

const { POST } = await import('@/app/api/blender-mcp/route');

let mock: MockBlenderServer | null = null;

afterEach(async () => {
  const { getService, resetService } = await import('@/lib/blender-mcp/service');
  getService().disconnect();
  resetService();
  if (mock) {
    await mock.close();
    mock = null;
  }
});

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost:3001/api/blender-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function statusConnection() {
  const res = await post({ action: 'status' });
  const json = (await res.json()) as {
    success: boolean;
    data: { connection: { connected: boolean; lastProbeError?: string } };
  };
  expect(json.success).toBe(true);
  return json.data.connection;
}

describe('POST /api/blender-mcp — status is a probe', () => {
  it('round-trips a real get_scene_info for every status call', async () => {
    mock = await createMockBlenderServer(() => SCENE_OK);
    const connectRes = await post({
      action: 'connect',
      host: '127.0.0.1',
      port: mock.port,
    });
    expect(connectRes.status).toBe(200);

    const sentByConnect = mock.received.length;
    const conn = await statusConnection();

    expect(conn.connected).toBe(true);
    expect(mock.received.length).toBe(sentByConnect + 1);
    expect(mock.received[sentByConnect].type).toBe('get_scene_info');
  });

  it(
    'reports disconnected, with the reason, once the addon wedges',
    async () => {
      let answered = 0;
      mock = await createMockBlenderServer(() =>
        answered++ === 0 ? SCENE_OK : null,
      );
      await post({ action: 'connect', host: '127.0.0.1', port: mock.port });

      const conn = await statusConnection();

      expect(conn.connected).toBe(false);
      expect(conn.lastProbeError).toBeTruthy();
    },
    20_000,
  );

  it('answers instantly, and sends nothing, when nothing is connected', async () => {
    mock = await createMockBlenderServer(() => SCENE_OK);
    const conn = await statusConnection();
    expect(conn.connected).toBe(false);
    expect(mock.received.length).toBe(0);
  });
});
