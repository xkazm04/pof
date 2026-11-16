import { describe, expect, it, vi } from 'vitest';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob, getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTrellisJob, getTrellisJob } from '@/lib/visual-gen/trellis-job-store';

/** Stubs only: no GPU, WSL or model is ever run. */
const SPEC = { imagePath: 'i.png', outputPath: 'o.glb' };
const pass = async () => ({ ok: true, verdict: 'pass' as const, score: 100, reasons: [] });
const okRun = async () => ({ ok: true, meshPath: 'm.glb', durationMs: 1 });
const failRun = async () => ({ ok: false, error: 'cuda oom', durationMs: 1 });
const throwRun = async (): Promise<never> => { throw new Error('spawn failed'); };
const boom = async (): Promise<never> => { throw new Error('critic blew up'); };

type Runner = () => Promise<unknown>;
type Critic = () => Promise<unknown>;
type Settled = { status: string; error?: string; accepted?: boolean; ungated?: boolean; gateReason?: string; critique?: unknown };

const STORES: [string, (r: Runner, c: Critic, onSettled?: () => void) => Settled][] = [
  ['triposr', (r, c, s) => getTriposrJob(startTriposrJob(SPEC, r as never, c as never, s))!],
  ['hunyuan', (r, c, s) => getHunyuanJob(startHunyuanJob(SPEC, r as never, c as never, s))!],
  ['trellis', (r, c, s) => getTrellisJob(startTrellisJob(SPEC, r as never, c as never, s))!],
];

describe.each(STORES)('%s settle lifecycle', (_n, start) => {
  it('accepts a passing mesh and fires onSettled once', async () => {
    const settled = vi.fn();
    const job = start(okRun, pass, settled);
    await vi.waitFor(() => expect(job.status).toBe('done'));
    expect(job.accepted).toBe(true);
    expect(job.ungated).toBe(false);
    expect(job.critique).toBeDefined();
    await vi.waitFor(() => expect(settled).toHaveBeenCalledTimes(1));
  });

  it('reports a runner failure as error with its reason and no gate verdict', async () => {
    const job = start(failRun, pass);
    await vi.waitFor(() => expect(job.status).toBe('error'));
    expect(job.error).toBe('cuda oom');
    expect(job.accepted).toBeUndefined();
  });

  it('reports a runner throw as error', async () => {
    const job = start(throwRun, pass);
    await vi.waitFor(() => expect(job.status).toBe('error'));
    expect(job.error).toBe('spawn failed');
  });

  it('keeps a mesh whose critic threw as delivered-ungated with the reason', async () => {
    const job = start(okRun, boom);
    await vi.waitFor(() => expect(job.status).toBe('done'));
    expect(job.ungated).toBe(true);
    expect(job.gateReason).toContain('critic blew up');
  });
});
