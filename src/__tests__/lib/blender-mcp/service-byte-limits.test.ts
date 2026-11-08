/**
 * The bridge's documented byte limits are measured in BYTES: the 8 MB receive ceiling and
 * executeCode's 100 KB code limit. A multi-byte payload that is under the limit in UTF-16
 * code units but over it in bytes must trip both. Mock socket only, no Blender.
 */
import { describe, it, expect, afterEach } from 'vitest';
import net from 'net';
import { createMockBlenderServer, SCENE_OK, type MockBlenderServer } from './mockBlenderServer';

let mock: MockBlenderServer | null = null;
let flood: net.Server | null = null;
const sockets: net.Socket[] = [];

afterEach(async () => {
  const { getService, resetService } = await import('@/lib/blender-mcp/service');
  getService().disconnect();
  resetService();
  sockets.forEach((s) => s.destroy());
  sockets.length = 0;
  if (mock) await mock.close();
  mock = null;
  if (flood) await new Promise<void>((r) => flood!.close(() => r()));
  flood = null;
});

describe('executeCode size limit', () => {
  it('refuses code over 100 KB in bytes even when it is under 100k characters', async () => {
    mock = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      return cmd.type === 'get_scene_info' ? SCENE_OK : JSON.stringify({ status: 'success', result: { output: 'ok' } });
    });
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    expect((await svc.connect('127.0.0.1', mock.port)).ok).toBe(true);
    const code = `x = "${'é'.repeat(60_000)}"`; // 60k characters, ~120 KB
    expect(code.length).toBeLessThan(100_000);
    const r = await svc.executeCode(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/100KB/);
    expect(mock.received.some((c) => c.type === 'execute_code')).toBe(false);
  });
});

describe('receive ceiling', () => {
  it('trips on 9 MB of 3-byte characters, which is under 8M code units', async () => {
    const chars = 3_000_000;
    flood = net.createServer((socket) => {
      sockets.push(socket);
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf-8');
        let cmd: { type: string };
        try { cmd = JSON.parse(buf); } catch { return; }
        buf = '';
        if (cmd.type === 'get_scene_info') { socket.write(SCENE_OK); return; }
        // An unterminated value: it never parses, so only the ceiling can end the command.
        socket.write('{"status":"success","result":{"output":"');
        const piece = Buffer.from('€'.repeat(100_000), 'utf-8');
        for (let i = 0; i < chars / 100_000; i++) socket.write(piece);
        // If the ceiling is not enforced in bytes the command would wait out its timeout; drop
        // the socket shortly after so the failure is an assertion, not a hang.
        setTimeout(() => socket.destroy(), 500);
      });
      socket.on('error', () => undefined);
    });
    const port = await new Promise<number>((resolve) =>
      flood!.listen(0, '127.0.0.1', () => resolve((flood!.address() as net.AddressInfo).port)),
    );
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    expect((await svc.connect('127.0.0.1', port)).ok).toBe(true);
    const r = await svc.executeCode('print(1)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Response exceeded/);
  });
});
