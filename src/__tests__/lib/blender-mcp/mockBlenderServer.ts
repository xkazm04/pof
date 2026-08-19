/**
 * The mock Blender addon used by every bridge suite.
 *
 * Extracted verbatim in behaviour from `service.test.ts` (where it lived as a
 * file-local helper) and given three things the probe suites need:
 *
 * - a handler may return `null` to answer NOTHING — that is the wedged addon,
 *   the exact failure a cached `connected` boolean can never see: TCP is up,
 *   the socket is open, and `get_scene_info` never comes back;
 * - a handler may be async, so a response can be HELD to model a long user
 *   script occupying the serialized command chain;
 * - every received command is recorded, so a test can assert what actually went
 *   on the wire rather than trusting a return value.
 */
import net from 'net';

export interface MockBlenderServer {
  server: net.Server;
  port: number;
  /** Every command the addon received, in order, parsed. */
  received: { type: string; params?: Record<string, unknown> }[];
  close: () => Promise<void>;
}

export type MockHandler = (
  data: string,
) => string | null | Promise<string | null>;

export function createMockBlenderServer(
  handler: MockHandler,
): Promise<MockBlenderServer> {
  return new Promise((resolve) => {
    const received: MockBlenderServer['received'] = [];
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => {
      sockets.push(socket);
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        let command: { type: string; params?: Record<string, unknown> };
        try {
          command = JSON.parse(buffer);
        } catch {
          return; // incomplete JSON, wait for more
        }
        const raw = buffer;
        buffer = '';
        received.push(command);
        void Promise.resolve(handler(raw)).then((response) => {
          // `null` = the addon is wedged: it holds the socket and says nothing.
          if (response !== null && !socket.destroyed) socket.write(response);
        });
      });
      // A test closing the server mid-hold must not surface as an unhandled error.
      socket.on('error', () => undefined);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        server,
        port: addr.port,
        received,
        close: () =>
          new Promise<void>((r) => {
            // A socket the client never closed (wedged-addon tests) would keep
            // `server.close()` pending forever; drop them explicitly first.
            server.close(() => r());
            sockets.forEach((s) => s.destroy());
          }),
      });
    });
  });
}

/** A minimal, always-valid `get_scene_info` reply. */
export const SCENE_OK = JSON.stringify({
  status: 'success',
  result: { objects: [], collections: [], frameRange: [1, 250] },
});
