import { describe, it, expect, afterEach } from 'vitest';
import {
  createMockBlenderServer,
  type MockBlenderServer,
} from './mockBlenderServer';

describe('BlenderMCPService', () => {
  let mockServer: MockBlenderServer | null = null;

  afterEach(async () => {
    // Dynamic import to get fresh singleton per test via resetService
    const { getService, resetService } = await import(
      '@/lib/blender-mcp/service'
    );
    getService().disconnect();
    resetService();
    if (mockServer) {
      await mockServer.close();
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
    mockServer = created;

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
    const created = await createMockBlenderServer((data) => {
      const cmd = JSON.parse(data);
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
    mockServer = created;

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
    let calls = 0;
    const created = await createMockBlenderServer(() => {
      if (++calls === 1) {
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
    mockServer = created;

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
