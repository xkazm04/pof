/**
 * A generation job the addon accepted but answered without a job id cannot be tracked:
 * the status/import routes key everything on it and the ledger records the paid job under
 * it. `createJob` used to coerce a missing id to '' and return ok, so every such job was
 * ledgered under the same empty key and polled with `job_id: ''`. Mock socket only.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createMockBlenderServer, SCENE_OK, type MockBlenderServer } from './mockBlenderServer';

let mock: MockBlenderServer | null = null;

afterEach(async () => {
  const { getService, resetService } = await import('@/lib/blender-mcp/service');
  getService().disconnect();
  resetService();
  if (mock) await mock.close();
  mock = null;
});

async function connectWith(createReply: unknown) {
  mock = await createMockBlenderServer((data) => {
    const cmd = JSON.parse(data);
    if (cmd.type === 'get_scene_info') return SCENE_OK;
    return JSON.stringify({ status: 'success', result: createReply });
  });
  const { getService } = await import('@/lib/blender-mcp/service');
  const svc = getService();
  expect((await svc.connect('127.0.0.1', mock.port)).ok).toBe(true);
  return svc;
}

describe('BlenderMCPService.createJob', () => {
  it('refuses a reply with no job id instead of tracking an empty one', async () => {
    const svc = await connectWith({ uuid: 'abc' });
    const hyper = await svc.generateHyper3D('crate');
    const hunyuan = await svc.generateHunyuan3D('crate');
    for (const r of [hyper, hunyuan]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/no job id/i);
    }
  });

  it('still returns the job id the addon gave', async () => {
    const svc = await connectWith({ jobId: 'job-42' });
    const r = await svc.generateHyper3D('crate');
    expect(r).toEqual({ ok: true, data: { jobId: 'job-42', status: 'pending' } });
  });
});
