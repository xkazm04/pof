/**
 * The cook-job HTTP surface: GET answers the project's active job (reattach), GET
 * `?attach=` streams a job from a seq (resume), DELETE cancels by id. POST
 * /api/packaging/execute starts a job and stays the same SSE stream it always was,
 * except that a busy project is refused with the active job's id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { CookEvent, CookExecutorOptions } from '@/lib/packaging/cook-executor';

vi.mock('@/lib/packaging/cook-executor', () => ({ cookExecutor: vi.fn() }));
vi.mock('@/lib/packaging/build-profiles-db', () => ({ getProfile: vi.fn() }));
vi.mock('@/lib/packaging/build-history-store', () => ({
  insertBuild: vi.fn(() => ({ id: 11 })),
  lastGreenBaseline: vi.fn(() => null),
}));
vi.mock('@/lib/packaging/version-manager', () => ({ autoIncrementOnSuccess: vi.fn(() => '0.2.0') }));

import { POST } from '@/app/api/packaging/execute/route';
import { GET, DELETE } from '@/app/api/packaging/cook-jobs/route';
import { cookExecutor } from '@/lib/packaging/cook-executor';
import { getProfile } from '@/lib/packaging/build-profiles-db';
import { __resetCookJobsForTests, awaitCookJob, getCookJob } from '@/lib/packaging/cook-jobs';

type AnyEvent = Record<string, unknown> & { type: string; seq?: number };

const PROFILE = {
  id: 'p1', name: 'Win64 Shipping', platform: 'Win64', config: 'Shipping', isDefault: false,
  cookSettings: {
    mapsToInclude: [], pluginsToDisable: [], usePak: true, compressPak: true, encryptPak: false,
    useIoStore: false, iterativeCooking: false, cookOnTheFly: false,
    textureStreamingBudgetMB: 0, compressTextures: true,
  },
  platformSettings: { architecture: 'x64', customFlags: [] },
  outputDir: '', stage: true, archive: false, archiveDir: '', runAfterPackage: false,
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
};

const BODY = { profileId: 'p1', projectPath: 'C:/P', projectName: 'P', ueVersion: '5.5' };

function post(body: unknown): Request {
  return new Request('http://localhost:3000/api/packaging/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const req = (qs: string, method = 'GET') => new NextRequest(`http://localhost:3000/api/packaging/cook-jobs?${qs}`, { method });

async function readSSE(stream: ReadableStream<Uint8Array>): Promise<AnyEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: AnyEvent[] = [];
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.replace(/^data:\s?/, '').trim();
      if (line) events.push(JSON.parse(line) as AnyEvent);
    }
  }
  return events;
}

/** The executor holds after its first events until released (or aborted). */
function holdingExecutor() {
  let release!: () => void;
  const held = new Promise<void>((r) => { release = r; });
  const seen: { signal?: AbortSignal } = {};
  vi.mocked(cookExecutor).mockImplementationOnce(async function* (opts: CookExecutorOptions) {
    seen.signal = opts.signal;
    yield { type: 'phase', phase: 'cook', t: 0 } as CookEvent;
    yield { type: 'log', line: 'LogCook: cooking', t: 1 } as CookEvent;
    await new Promise<void>((resolve) => {
      void held.then(resolve);
      opts.signal?.addEventListener('abort', () => resolve());
      if (opts.signal?.aborted) resolve();
    });
    if (opts.signal?.aborted) {
      yield { type: 'error', message: 'cook cancelled — process tree terminated', status: 'cancelled', t: 2 } as CookEvent;
      return;
    }
    yield { type: 'done', exePath: 'C:/out/P.exe', durationMs: 3, sizeBytes: null, status: 'success', t: 3 } as CookEvent;
  } as typeof cookExecutor);
  return { release: () => release(), seen };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetCookJobsForTests();
  vi.mocked(getProfile).mockReturnValue(PROFILE as ReturnType<typeof getProfile>);
});

describe('GET /api/packaging/cook-jobs', () => {
  it('answers the active job for a project, and null when there is none', async () => {
    const none = await (await GET(req('projectPath=C:/P'))).json();
    expect(none).toEqual({ success: true, data: { job: null } });

    const h = holdingExecutor();
    const started = await POST(post(BODY));
    const jobId = started.headers.get('X-Cook-Job-Id');
    expect(jobId).toBeTruthy();

    const body = await (await GET(req('projectPath=C:/P'))).json();
    expect(body.success).toBe(true);
    expect(body.data.job).toMatchObject({ jobId, profileId: 'p1', kind: 'interactive', settled: false });
    expect(typeof body.data.job.startedAt).toBe('number');
    expect(typeof body.data.job.lastSeq).toBe('number');

    h.release();
    await readSSE(started.body!);
    const after = await (await GET(req('projectPath=C:/P'))).json();
    expect(after.data.job).toBeNull();
  });

  it('streams a job from a seq on ?attach= (resume without duplicates)', async () => {
    const h = holdingExecutor();
    const started = await POST(post(BODY));
    const jobId = started.headers.get('X-Cook-Job-Id')!;
    await vi.waitFor(() => expect(getCookJob(jobId)?.lastSeq).toBe(1));
    h.release();
    await awaitCookJob(jobId);

    const res = await GET(req(`attach=${jobId}&from=1`));
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const events = await readSSE(res.body!);
    expect(events[0].seq).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['log', 'done', 'recorded']);
  });
});

describe('DELETE /api/packaging/cook-jobs', () => {
  it('cancels a job by id (the executor is aborted); an unknown id is 404', async () => {
    const h = holdingExecutor();
    const started = await POST(post(BODY));
    const jobId = started.headers.get('X-Cook-Job-Id')!;

    const res = await DELETE(req(`jobId=${jobId}`, 'DELETE'));
    expect(res.status).toBe(200);
    expect(h.seen.signal?.aborted).toBe(true);
    const events = await readSSE(started.body!);
    const err = events.find((e) => e.type === 'error');
    expect(err?.status).toBe('cancelled');
    expect(events.at(-1)?.type === 'recorded' || events.some((e) => e.type === 'recorded')).toBe(true);

    const missing = await DELETE(req('jobId=nope', 'DELETE'));
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/packaging/execute', () => {
  it('refuses a cook of a busy project with 409 naming the active job', async () => {
    const h = holdingExecutor();
    const first = await POST(post(BODY));
    const jobId = first.headers.get('X-Cook-Job-Id')!;

    const second = await POST(post(BODY));
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain(jobId);
    expect(cookExecutor).toHaveBeenCalledTimes(1);

    h.release();
    await readSSE(first.body!);
  });

  it('[guard] an idle project streams phase/progress/log/done then recorded, in order', async () => {
    vi.mocked(cookExecutor).mockImplementationOnce(async function* () {
      yield { type: 'phase', phase: 'cook', t: 0 } as CookEvent;
      yield { type: 'progress', percent: 50, t: 1 } as CookEvent;
      yield { type: 'log', line: 'LogCook: cooking', t: 2 } as CookEvent;
      yield { type: 'done', exePath: 'C:/out/P.exe', durationMs: 3, sizeBytes: null, status: 'success', t: 3 } as CookEvent;
    } as typeof cookExecutor);
    const res = await POST(post(BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const events = await readSSE(res.body!);
    expect(events.map((e) => e.type)).toEqual(['phase', 'progress', 'log', 'done', 'recorded']);
    expect(events.at(-1)?.buildId).toBe(11);
  });
});
