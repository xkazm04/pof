/**
 * The bridge status must be a PROBE, not a cached boolean.
 *
 * Forced-failure suite for `blender-bridge-status-is-not-a-probe`. Before the
 * change, `action:'status'` was the whole of `getStatus()` — `{...this.connection}`,
 * a copy of a field no traffic ever verified. A wedged addon (TCP up, socket
 * open, `get_scene_info` never answered) therefore reported `connected: true`
 * forever, which is what kept all 19 Produce gates enabled and pushed the
 * failure out to a 30s timeout per dispatch.
 *
 * Every assertion below is red at HEAD~1: `probe` does not exist there, and the
 * only thing that could stand in for it (`getStatus`) returns `connected: true`
 * against a server that has stopped answering.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createMockBlenderServer,
  SCENE_OK,
  type MockBlenderServer,
} from './mockBlenderServer';

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

async function connected(handler: Parameters<typeof createMockBlenderServer>[0]) {
  mock = await createMockBlenderServer(handler);
  const { getService } = await import('@/lib/blender-mcp/service');
  const svc = getService();
  const result = await svc.connect('127.0.0.1', mock.port);
  expect(result.ok).toBe(true);
  return svc;
}

describe('BlenderMCPService.probe — real bytes, not a cached flag', () => {
  it('reports connected when the addon answers get_scene_info', async () => {
    const svc = await connected(() => SCENE_OK);

    const before = mock!.received.length;
    const status = await svc.probe();

    expect(status.connected).toBe(true);
    expect(status.lastProbeError).toBeUndefined();
    expect(typeof status.lastProbeAt).toBe('number');
    // It actually put a command on the wire — the whole point.
    expect(mock!.received.length).toBe(before + 1);
    expect(mock!.received[before].type).toBe('get_scene_info');
  });

  it(
    'reports NOT connected — with a reason — against an addon that accepts TCP but stops answering',
    async () => {
      let answered = 0;
      // Answers the connect-time health check, then goes silent forever while
      // holding the socket open. This is the failure a cached boolean cannot see.
      const svc = await connected(() => (answered++ === 0 ? SCENE_OK : null));

      const status = await svc.probe();

      expect(status.connected).toBe(false);
      expect(status.lastProbeError).toBeTruthy();
      expect(String(status.lastProbeError)).toMatch(/timed out/i);
      // and the cached view agrees afterwards — no stale "Connected" left behind
      expect(svc.getStatus().connected).toBe(false);
      expect(svc.getStatus().lastProbeError).toBeTruthy();
    },
    20_000,
  );

  it('does not dial, and sends nothing, when we already believe we are disconnected', async () => {
    const svc = await connected(() => SCENE_OK);
    const sentAfterConnect = mock!.received.length;
    svc.disconnect();

    const status = await svc.probe();

    expect(status.connected).toBe(false);
    expect(mock!.received.length).toBe(sentAfterConnect);
  });

  it('collapses concurrent probes onto ONE in-flight request', async () => {
    const svc = await connected(
      () => new Promise<string>((r) => setTimeout(() => r(SCENE_OK), 120)),
    );
    const before = mock!.received.length;

    const [a, b, c] = await Promise.all([svc.probe(), svc.probe(), svc.probe()]);

    expect(a.connected && b.connected && c.connected).toBe(true);
    // One health tick per interval must not become one queue entry per tick.
    expect(mock!.received.length).toBe(before + 1);
  });

  it(
    'does not time out while QUEUED behind a long user script — the budget starts at run, not at enqueue',
    async () => {
      // The probe's own budget is the 8s FAST_COMMANDS class. This script holds
      // the serialized command chain for LONGER than that, so if the timeout
      // were armed at enqueue the probe would fail and (worse) `sendCommandRaw`
      // would tear down a perfectly healthy connection.
      const HOLD_MS = 8_600;
      let seen = 0;
      const svc = await connected((raw) => {
        seen++;
        const cmd = JSON.parse(raw) as { type: string };
        if (cmd.type === 'execute_code' && seen > 1) {
          return new Promise<string>((r) =>
            setTimeout(
              () => r(JSON.stringify({ status: 'success', result: { output: 'slow ok' } })),
              HOLD_MS,
            ),
          );
        }
        return SCENE_OK;
      });

      const started = Date.now();
      const script = svc.executeCode('bpy.ops.wm.slow()');
      const probe = svc.probe(); // enqueued immediately, behind the script
      const [scriptResult, status] = await Promise.all([script, probe]);
      const elapsed = Date.now() - started;

      expect(scriptResult.ok).toBe(true);
      // The probe waited out the whole script and STILL succeeded.
      expect(status.connected).toBe(true);
      expect(status.lastProbeError).toBeUndefined();
      expect(elapsed).toBeGreaterThan(HOLD_MS);
      // And it never pre-empted the script: the script's command reached the
      // addon before the probe's did.
      const types = mock!.received.map((c) => c.type);
      expect(types.indexOf('execute_code')).toBeLessThan(types.lastIndexOf('get_scene_info'));
    },
    30_000,
  );
});

describe('BlenderConnection carries no fabricated Blender version', () => {
  it('never invents a blenderVersion on a successful connect', async () => {
    const svc = await connected(() => SCENE_OK);
    // The field is gone from the type; assert at runtime too, so a future
    // re-introduction has to come with a real handshake that writes it.
    expect(
      (svc.getStatus() as unknown as Record<string, unknown>).blenderVersion,
    ).toBeUndefined();
  });
});
