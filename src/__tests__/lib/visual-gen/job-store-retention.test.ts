import { afterEach, describe, expect, it, vi } from 'vitest';
import { startTripoJob, getTripoJob } from '@/lib/visual-gen/tripo-job-store';
import { startTriposrJob, getTriposrJob } from '@/lib/visual-gen/triposr-job-store';
import { startHunyuanJob, getHunyuanJob } from '@/lib/visual-gen/hunyuan-job-store';
import { startTrellisJob, getTrellisJob } from '@/lib/visual-gen/trellis-job-store';

/** Stubs only: no provider, GPU or network is ever touched. */
const CAP = 200;
const RUNS = 210;
const ok = async () => ({ ok: true, meshPath: 'm.glb', durationMs: 1, taskId: 't', status: 'success' as const });
const pass = async () => ({ ok: true, verdict: 'pass' as const, score: 100, reasons: [] });
const never = () => new Promise<never>(() => {});
const SPEC = { imagePath: 'i.png', outputPath: 'o.glb' };
const TRIPO_SPEC = { mode: 'text-to-3d' as const, prompt: 'x', outputPath: 'o.glb' };

type Store = {
  name: string;
  globalKey: string;
  start: (runner: () => Promise<unknown>) => string;
  get: (id: string) => unknown;
};

const STORES: Store[] = [
  { name: 'tripo', globalKey: 'pofTripoJobs', get: getTripoJob,
    start: (r) => startTripoJob(TRIPO_SPEC, r as never, pass) },
  { name: 'triposr', globalKey: 'pofTriposrJobs', get: getTriposrJob,
    start: (r) => startTriposrJob(SPEC, r as never, pass) },
  { name: 'hunyuan', globalKey: 'pofHunyuanJobs', get: getHunyuanJob,
    start: (r) => startHunyuanJob(SPEC, r as never, pass) },
  { name: 'trellis', globalKey: 'pofTrellisJobs', get: getTrellisJob,
    start: (r) => startTrellisJob(SPEC, r as never, pass) },
];

const mapOf = (key: string) =>
  (globalThis as unknown as Record<string, Map<string, unknown>>)[key];

afterEach(() => STORES.forEach((s) => mapOf(s.globalKey)?.clear()));

describe.each(STORES)('$name job store retention', ({ globalKey, start, get }) => {
  it(`stays within ${CAP} jobs across ${RUNS} runs, keeps the newest readable`, async () => {
    mapOf(globalKey).clear();
    const ids: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const id = start(ok);
      ids.push(id);
      await vi.waitFor(() => expect((get(id) as { status: string }).status).toBe('done'), { interval: 1 });
    }
    expect(mapOf(globalKey).size).toBeLessThanOrEqual(CAP);
    expect(get(ids[ids.length - 1])).toBeDefined();
    expect(get(ids[0])).toBeUndefined();
  });

  it('never evicts a job that is still running', async () => {
    mapOf(globalKey).clear();
    const live = start(never);
    for (let i = 0; i < RUNS; i++) {
      const id = start(ok);
      await vi.waitFor(() => expect((get(id) as { status: string }).status).toBe('done'), { interval: 1 });
    }
    expect((get(live) as { status: string }).status).toBe('running');
    expect(mapOf(globalKey).size).toBeLessThanOrEqual(CAP);
  });
});
