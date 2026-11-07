/**
 * The bridge's receive path must decode UTF-8 across TCP chunk boundaries.
 *
 * The wire has no length prefix, so a large reply arrives in many `data` events. A
 * multi-byte character (an em dash in a raise message, an accented object name) split
 * between two chunks was decoded per chunk, so each half became U+FFFD and the text the
 * operator saw was not the text Blender sent. Uses a local mock socket — no Blender.
 */
import { describe, it, expect, afterEach } from 'vitest';
import net from 'net';
import { SCENE_OK } from './mockBlenderServer';

let server: net.Server | null = null;
const sockets: net.Socket[] = [];

afterEach(async () => {
  const { getService, resetService } = await import('@/lib/blender-mcp/service');
  getService().disconnect();
  resetService();
  sockets.forEach((s) => s.destroy());
  sockets.length = 0;
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  server = null;
});

/** A mock addon that answers execute_code with `reply`, written in two writes split at byte `cut`. */
function splitReplyServer(reply: string, cut: (bytes: Buffer) => number): Promise<number> {
  return new Promise((resolve) => {
    server = net.createServer((socket) => {
      sockets.push(socket);
      socket.setNoDelay(true);
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        let cmd: { type: string };
        try { cmd = JSON.parse(buffer); } catch { return; }
        buffer = '';
        if (cmd.type === 'get_scene_info') { socket.write(SCENE_OK); return; }
        const bytes = Buffer.from(reply, 'utf-8');
        const at = cut(bytes);
        socket.write(bytes.subarray(0, at));
        setTimeout(() => { if (!socket.destroyed) socket.write(bytes.subarray(at)); }, 40);
      });
      socket.on('error', () => undefined);
    });
    server.listen(0, '127.0.0.1', () => resolve((server!.address() as net.AddressInfo).port));
  });
}

describe('BlenderMCPService receive decoding', () => {
  it('keeps a multi-byte character intact when it straddles two TCP chunks', async () => {
    const printed = 'Deleted object: Kámen — done';
    const reply = JSON.stringify({ status: 'success', result: { output: printed } });
    // Cut inside the 3-byte em dash (E2 80 94): after its first byte.
    const port = await splitReplyServer(reply, (b) => b.indexOf(0xe2) + 1);

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    expect((await svc.connect('127.0.0.1', port)).ok).toBe(true);
    const out = await svc.executeCode('print(1)');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.output).toBe(printed);
      expect(out.data.output).not.toContain('�');
    }
  });

  it('keeps an error message intact when the split lands inside a 2-byte character', async () => {
    const message = "Object 'Kámen' not found";
    const reply = JSON.stringify({ status: 'error', message });
    const port = await splitReplyServer(reply, (b) => b.indexOf(0xc3) + 1);

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    expect((await svc.connect('127.0.0.1', port)).ok).toBe(true);
    const out = await svc.executeCode('print(1)');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe(message);
  });
});
