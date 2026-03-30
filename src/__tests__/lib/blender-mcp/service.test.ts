import { describe, it, expect, afterEach } from 'vitest';
import net from 'net';

function createMockBlenderServer(
  handler: (data: string) => string,
): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        try {
          JSON.parse(buffer);
          const response = handler(buffer);
          buffer = '';
          socket.write(response);
        } catch {
          /* incomplete JSON, wait for more */
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port });
    });
  });
}

describe('BlenderMCPService', () => {
  let mockServer: net.Server | null = null;

  afterEach(async () => {
    // Dynamic import to get fresh singleton per test via resetService
    const { getService, resetService } = await import(
      '@/lib/blender-mcp/service'
    );
    getService().disconnect();
    resetService();
    if (mockServer) {
      await new Promise<void>((r) => mockServer!.close(() => r()));
      mockServer = null;
    }
  });

  it('connects to Blender addon and returns scene info', async () => {
    const sceneData = {
      objects: [
        { name: 'Cube', type: 'MESH', location: [0, 0, 0], visible: true },
      ],
      activeObject: 'Cube',
      collections: ['Collection'],
      frameRange: [1, 250],
    };

    const created = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      if (cmd.type === 'get_scene_info') {
        return JSON.stringify({ status: 'success', result: sceneData });
      }
      return JSON.stringify({ status: 'error', message: 'Unknown command' });
    });
    mockServer = created.server;

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    const connResult = await svc.connect('127.0.0.1', created.port);
    expect(connResult.ok).toBe(true);

    const sceneResult = await svc.getSceneInfo();
    expect(sceneResult.ok).toBe(true);
    if (sceneResult.ok) {
      expect(sceneResult.data.objects).toHaveLength(1);
      expect(sceneResult.data.objects[0].name).toBe('Cube');
    }
  });

  it('returns error Result on connection failure', async () => {
    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    // Port 1 is almost certainly not running a Blender addon
    const result = await svc.connect('127.0.0.1', 1);
    expect(result.ok).toBe(false);
  });

  it('executes arbitrary Python code', async () => {
    // First call is health-check (get_scene_info from connect), second is execute_code
    let callCount = 0;
    const created = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
      callCount++;
      if (cmd.type === 'get_scene_info') {
        return JSON.stringify({
          status: 'success',
          result: {
            objects: [],
            collections: [],
            frameRange: [1, 250],
          },
        });
      }
      if (cmd.type === 'execute_code') {
        return JSON.stringify({
          status: 'success',
          result: { output: 'Created cube' },
        });
      }
      return JSON.stringify({ status: 'error', message: 'Unknown' });
    });
    mockServer = created.server;

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    await svc.connect('127.0.0.1', created.port);

    const result = await svc.executeCode(
      'bpy.ops.mesh.primitive_cube_add()',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.output).toBe('Created cube');
    }
  });

  it('returns error when Blender reports error status', async () => {
    let callCount = 0;
    const created = await createMockBlenderServer((data) => {
      callCount++;
      if (callCount === 1) {
        // Health check during connect
        return JSON.stringify({
          status: 'success',
          result: { objects: [], collections: [], frameRange: [1, 250] },
        });
      }
      return JSON.stringify({
        status: 'error',
        message: 'NameError: name "foo" is not defined',
      });
    });
    mockServer = created.server;

    const { getService } = await import('@/lib/blender-mcp/service');
    const svc = getService();
    await svc.connect('127.0.0.1', created.port);

    const result = await svc.executeCode('foo()');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('NameError');
    }
  });
});
