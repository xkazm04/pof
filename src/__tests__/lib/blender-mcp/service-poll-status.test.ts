/**
 * pollJobStatus must hand the forge queue a status inside the JobStatus union and a
 * finite 0-100 progress, whatever the addon's provider wrote. Mock socket only.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createMockBlenderServer, SCENE_OK, type MockBlenderServer } from './mockBlenderServer';

const UNION = ['pending', 'processing', 'completed', 'failed'];
let mock: MockBlenderServer | null = null;

afterEach(async () => {
  const { getService, resetService } = await import('@/lib/blender-mcp/service');
  getService().disconnect();
  resetService();
  if (mock) await mock.close();
  mock = null;
});

async function poll(reply: unknown) {
  mock = await createMockBlenderServer((data) => {
    const cmd = JSON.parse(data);
    if (cmd.type === 'get_scene_info') return SCENE_OK;
    return JSON.stringify({ status: 'success', result: reply });
  });
  const { getService } = await import('@/lib/blender-mcp/service');
  const svc = getService();
  expect((await svc.connect('127.0.0.1', mock.port)).ok).toBe(true);
  const r = await svc.pollJobStatus('job-1', 'hyper3d');
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe('BlenderMCPService.pollJobStatus normalisation', () => {
  it('maps off-vocabulary terminal words into the union', async () => {
    expect((await poll({ status: 'Done' })).status).toBe('completed');
  });

  it('is case-insensitive for known words', async () => {
    expect((await poll({ status: 'COMPLETED' })).status).toBe('completed');
  });

  it('maps failure synonyms to failed', async () => {
    expect((await poll({ status: 'Error' })).status).toBe('failed');
  });

  it('never leaves an unknown word outside the union, and does not call it finished', async () => {
    const data = await poll({ status: 'Frobnicating' });
    expect(UNION).toContain(data.status);
    expect(data.status).toBe('processing');
  });

  it('turns a non-numeric progress into a finite 0-100 number', async () => {
    for (const bad of ['abc', 'n/a', null, {}, [1, 2]]) {
      const data = await poll({ status: 'processing', progress: bad });
      expect(Number.isFinite(data.progress)).toBe(true);
      expect(data.progress).toBeGreaterThanOrEqual(0);
      expect(data.progress).toBeLessThanOrEqual(100);
      await mock?.close();
      mock = null;
      const { getService, resetService } = await import('@/lib/blender-mcp/service');
      getService().disconnect();
      resetService();
    }
  });

  it('clamps out-of-range progress and passes a sane one through', async () => {
    expect((await poll({ status: 'processing', progress: 250 })).progress).toBe(100);
  });

  it('keeps a missing status as pending and a valid reply untouched', async () => {
    const data = await poll({ progress: 40 });
    expect(data.status).toBe('pending');
    expect(data.progress).toBe(40);
  });
});
