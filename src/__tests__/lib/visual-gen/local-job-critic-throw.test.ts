import { describe, expect, it, vi } from 'vitest';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob, getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTrellisJob, getTrellisJob } from '@/lib/visual-gen/trellis-job-store';

const ok = async () => ({ ok: true, meshPath: 'm.glb', durationMs: 1 });
const critic = async () => { throw new Error('critic blew up'); };
const SPEC = { imagePath: 'i.png', outputPath: 'o.glb' };

describe.each([
  ['triposr', () => getTriposrJob(startTriposrJob(SPEC, ok, critic))],
  ['hunyuan', () => getHunyuanJob(startHunyuanJob(SPEC, ok, critic))],
  ['trellis', () => getTrellisJob(startTrellisJob(SPEC, ok, critic))],
])('%s job: a throwing critic', (_name, start) => {
  it('says the critique failed, never that no mesh was produced', async () => {
    const job = start()!;
    await vi.waitFor(() => expect(job.status).toBe('done'));
    expect(job.ungated).toBe(true);
    expect(job.accepted).toBe(false);
    expect(job.gateReason).toContain('critic blew up');
    expect(job.gateReason).not.toContain('no mesh was produced');
  });
});
