/**
 * Cooks are server jobs: one owner per project, shared by the interactive Package
 * button and the nightly runner. The browser SUBSCRIBES to a job (replay from a seq)
 * instead of owning the process: a client that goes away detaches, only an explicit
 * cancel kills the process tree, and a cancelled cook is recorded as cancelled.
 *
 * No real UAT is ever spawned here: the executor is a fake generator, or the real
 * `cookExecutor` over a fake child whose tree-kill is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import type { CookEvent, CookExecutorOptions } from '@/lib/packaging/cook-executor';
import type { BuildProfile } from '@/lib/packaging/build-profiles';
import type { FinalizeDeps } from '@/lib/packaging/finalize-build';

// ── Module mocks for the nightly path (startScheduledRun) — never a real git/UAT/db ──
const nightly = vi.hoisted(() => ({
  headResolve: null as null | ((head: string | null) => void),
}));
vi.mock('@/lib/process-tree-kill', () => ({ killProcessTree: vi.fn() }));
vi.mock('@/lib/packaging/git-head', () => ({
  getGitHead: vi.fn(() => new Promise<string | null>((resolve) => { nightly.headResolve = resolve; })),
}));
vi.mock('@/lib/packaging/build-profiles-db', () => ({
  getProfile: vi.fn(() => PROFILE),
  getProfiles: vi.fn(() => [PROFILE]),
}));
vi.mock('@/lib/packaging/build-schedule-store', () => ({
  getSchedule: vi.fn(),
  getScheduleState: vi.fn(() => ({ lastCommit: 'abc' })),
  setScheduleState: vi.fn(),
  isRunning: vi.fn(() => false),
}));
vi.mock('@/lib/packaging/preflight-runner', () => ({ runFastPreflight: vi.fn() }));
vi.mock('@/lib/packaging/build-history-store', () => ({
  insertBuild: vi.fn(() => ({ id: 7 })),
  lastGreenBaseline: vi.fn(() => null),
}));
vi.mock('@/lib/packaging/version-manager', () => ({ autoIncrementOnSuccess: vi.fn(() => '0.1.0') }));

import {
  startCookJob, subscribeCookJob, cancelCookJob, activeCookJob, getCookJob, awaitCookJob,
  cookJobEventStream, __resetCookJobsForTests, type SequencedCookEvent,
} from '@/lib/packaging/cook-jobs';
import { cookExecutor } from '@/lib/packaging/cook-executor';
import { startScheduledRun } from '@/lib/packaging/scheduled-build-runner';
import { killProcessTree } from '@/lib/process-tree-kill';

const PROFILE: BuildProfile = {
  id: 'a', name: 'Win64 Dev', platform: 'Win64', config: 'Development', isDefault: true,
  cookSettings: {
    mapsToInclude: [], pluginsToDisable: [], usePak: true, compressPak: true, encryptPak: false,
    useIoStore: false, iterativeCooking: false, cookOnTheFly: false,
    textureStreamingBudgetMB: 0, compressTextures: true,
  },
  platformSettings: { architecture: 'x64', customFlags: [] },
  outputDir: '', stage: true, archive: false, archiveDir: '', runAfterPackage: false,
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
};

const ctx = (projectPath = 'C:/P') => ({
  kind: 'interactive' as const, profile: PROFILE, projectPath, projectName: 'P', ueVersion: '5.5',
});

function finalizeDeps(): FinalizeDeps & { insertBuild: ReturnType<typeof vi.fn> } {
  return {
    lastGreenBaseline: () => null,
    evaluateBuildSize: () => null,
    nextVersion: () => '0.1.1',
    insertBuild: vi.fn(() => ({ id: 42 })),
  };
}

interface Gate { release: () => void; promise: Promise<void> }
function gate(): Gate {
  let release!: () => void;
  const promise = new Promise<void>((r) => { release = r; });
  return { release, promise };
}

const DONE: CookEvent = { type: 'done', exePath: 'C:/out/P.exe', durationMs: 9, sizeBytes: null, status: 'success', t: 9 };

/**
 * A fake executor: yields `pre`, then waits on the gate (or the abort signal), then
 * yields `post`. On abort it reports a cancelled cook like the real executor does.
 */
function gatedExecutor(pre: CookEvent[], g: Gate, post: CookEvent[] = [DONE]) {
  const seen: { signal: AbortSignal | undefined } = { signal: undefined };
  const executor = async function* (opts: CookExecutorOptions): AsyncGenerator<CookEvent> {
    seen.signal = opts.signal;
    for (const ev of pre) yield ev;
    await new Promise<void>((resolve) => {
      void g.promise.then(resolve);
      opts.signal?.addEventListener('abort', () => resolve());
      if (opts.signal?.aborted) resolve();
    });
    if (opts.signal?.aborted) {
      yield { type: 'error', message: 'cook cancelled — process tree terminated', status: 'cancelled', t: 5 };
      return;
    }
    for (const ev of post) yield ev;
  };
  return { executor, seen };
}

const THREE: CookEvent[] = [
  { type: 'phase', phase: 'cook', t: 0 },
  { type: 'progress', percent: 10, t: 1 },
  { type: 'log', line: 'LogCook: cooking', t: 2 },
];

beforeEach(() => {
  __resetCookJobsForTests();
  vi.mocked(killProcessTree).mockReset();
  nightly.headResolve = null;
});

describe('single-flight per project', () => {
  it('refuses a second cook of the same project, naming the active job; another project is fine', () => {
    const g = gate();
    const first = startCookJob(ctx('C:/P'), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = startCookJob(ctx('C:/P'), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain(first.data.jobId);

    // Same project spelled with backslashes and a trailing slash is the same lock.
    const spelled = startCookJob(ctx('c:\\P\\'), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    expect(spelled.ok).toBe(false);

    const other = startCookJob(ctx('C:/Q'), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    expect(other.ok).toBe(true);
    g.release();
  });
});

describe('ONE lock shared by the interactive and nightly paths', () => {
  const schedule = {
    enabled: true, time: '02:00', days: [], profileId: 'a', projectPath: 'C:/P', projectName: 'P',
    ueVersion: '5.5', skipIfUnchanged: true,
  } as unknown as Parameters<typeof startScheduledRun>[0];

  it('the nightly refuses to start while an interactive cook holds the project', () => {
    const g = gate();
    const job = startCookJob(ctx('C:/P'), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    expect(job.ok).toBe(true);

    const r = startScheduledRun(schedule, true);
    expect(r.ran).toBe(false);
    expect(r.reason).toMatch(/interactive cook/i);
    g.release();
  });

  it('an interactive cook is refused while the nightly holds the project', async () => {
    const r = startScheduledRun(schedule, true);
    expect(r.ran).toBe(true);
    const held = activeCookJob('C:/P');
    expect(held?.kind).toBe('nightly');

    const refused = startCookJob(ctx('C:/P'), { executor: gatedExecutor(THREE, gate()).executor, finalizeDeps: finalizeDeps() });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/nightly/i);

    // Unchanged tree → the nightly skips and releases the project.
    expect(nightly.headResolve).toBeTypeOf('function');
    nightly.headResolve!('abc');
    await awaitCookJob(held!.jobId);
    expect(activeCookJob('C:/P')).toBeNull();
  });
});

describe('subscribers replay by seq, then follow live', () => {
  it('replays 0..2 then delivers live events; resuming from 2 starts exactly at 2', async () => {
    const g = gate();
    const started = startCookJob(ctx(), { executor: gatedExecutor(THREE, g).executor, finalizeDeps: finalizeDeps() });
    if (!started.ok) throw new Error(started.error);
    const { jobId } = started.data;
    await vi.waitFor(() => expect(getCookJob(jobId)?.lastSeq).toBe(2));

    const all: SequencedCookEvent[] = [];
    const sub = subscribeCookJob(jobId, 0, { onEvent: (ev) => all.push(ev) });
    expect(sub.ok).toBe(true);
    expect(all.map((e) => e.seq)).toEqual([0, 1, 2]);

    const resumed: SequencedCookEvent[] = [];
    subscribeCookJob(jobId, 2, { onEvent: (ev) => resumed.push(ev) });
    expect(resumed[0].seq).toBe(2);
    expect(resumed.map((e) => e.seq)).toEqual([2]);

    g.release();
    await awaitCookJob(jobId);
    expect(all.map((e) => e.type)).toEqual(['phase', 'progress', 'log', 'done', 'recorded']);
    expect(all.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(resumed.map((e) => e.seq)).toEqual([2, 3, 4]);
  });
});

describe('a client that goes away detaches — it never cancels the cook', () => {
  it('aborting a subscriber stream leaves the executor running to done + recorded', async () => {
    const g = gate();
    const { executor, seen } = gatedExecutor(THREE, g);
    const fin = finalizeDeps();
    const started = startCookJob(ctx(), { executor, finalizeDeps: fin });
    if (!started.ok) throw new Error(started.error);
    const { jobId } = started.data;

    const client = new AbortController();
    const stream = cookJobEventStream(jobId, 0, client.signal);
    expect(stream).not.toBeNull();
    const reader = stream!.getReader();
    await reader.read(); // at least one event reached the client
    client.abort(); // the browser tab is gone

    expect(seen.signal?.aborted).toBe(false);
    g.release();
    const info = await awaitCookJob(jobId);
    expect(seen.signal?.aborted).toBe(false);
    expect(info.settled).toBe(true);

    const events: SequencedCookEvent[] = [];
    subscribeCookJob(jobId, 0, { onEvent: (ev) => events.push(ev) });
    const recorded = events.find((e) => e.type === 'recorded');
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(recorded && 'buildId' in recorded ? recorded.buildId : null).toBe(42);
    expect(fin.insertBuild).toHaveBeenCalledTimes(1);
  });
});

describe('cancel is explicit and is recorded as cancelled', () => {
  it('cancelCookJob aborts the executor; the job settles error{cancelled} then recorded', async () => {
    const g = gate();
    const { executor, seen } = gatedExecutor(THREE, g);
    const fin = finalizeDeps();
    const started = startCookJob(ctx(), { executor, finalizeDeps: fin });
    if (!started.ok) throw new Error(started.error);
    const { jobId } = started.data;
    await vi.waitFor(() => expect(getCookJob(jobId)?.lastSeq).toBe(2));

    const cancelled = cancelCookJob(jobId);
    expect(cancelled.ok).toBe(true);
    expect(seen.signal?.aborted).toBe(true);

    await awaitCookJob(jobId);
    const events: SequencedCookEvent[] = [];
    subscribeCookJob(jobId, 0, { onEvent: (ev) => events.push(ev) });
    const types = events.map((e) => e.type);
    const errIdx = types.indexOf('error');
    expect(errIdx).toBeGreaterThan(-1);
    const errEv = events[errIdx] as Extract<SequencedCookEvent, { type: 'error' }>;
    expect(errEv.status).toBe('cancelled');
    expect(types[errIdx + 1]).toBe('recorded');
    expect(types).not.toContain('done');
    const row = fin.insertBuild.mock.calls[0][0] as { status: string };
    expect(row.status).toBe('cancelled');
    expect(activeCookJob('C:/P')).toBeNull();
  });

  it('with the REAL executor, cancel kills the process tree and never reports a pass', async () => {
    const stdout = new PassThrough();
    const child = new EventEmitter() as ChildProcess;
    Object.assign(child, { stdout, stderr: null, stdin: null, pid: 4321, exitCode: null, kill: () => true });
    vi.mocked(killProcessTree).mockImplementation(() => {
      // The tree dies: the pipe closes and the wrapper exits non-zero.
      stdout.end();
      queueMicrotask(() => {
        (child as unknown as { exitCode: number }).exitCode = 1;
        child.emit('exit', 1);
      });
      return true;
    });
    const spawnFn = vi.fn(() => child);
    const started = startCookJob(ctx(), {
      executor: (opts) => cookExecutor({ ...opts, spawnFn }),
      finalizeDeps: finalizeDeps(),
    });
    if (!started.ok) throw new Error(started.error);
    stdout.write('LogCook: Display: Cook commandlet started\n');
    await vi.waitFor(() => expect(getCookJob(started.data.jobId)?.lastSeq).toBeGreaterThanOrEqual(0));

    cancelCookJob(started.data.jobId);
    await awaitCookJob(started.data.jobId);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(killProcessTree).toHaveBeenCalledWith(child, 'SIGTERM');
    const events: SequencedCookEvent[] = [];
    subscribeCookJob(started.data.jobId, 0, { onEvent: (ev) => events.push(ev) });
    expect(events.some((e) => e.type === 'done')).toBe(false);
    const errEv = events.find((e) => e.type === 'error') as Extract<SequencedCookEvent, { type: 'error' }>;
    expect(errEv.status).toBe('cancelled');
    expect(getCookJob(started.data.jobId)?.outcome).toMatch(/cancelled/i);
  });
});
