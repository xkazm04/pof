/**
 * The forge card's remedy — one explicit click routes a rejected (or budget-deferred)
 * delivery into the EXISTING $0 critique -> mesh-finish route, and nothing on this path
 * can ever reach a paid generation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within, act } from '@testing-library/react';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { useForgeStore, type GenerationJob } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

vi.mock('@/components/layout-lab/steps/shared/GlbPreviewPanel', () => ({
  GLB_PREVIEW_LABEL: '3D preview (orbit / zoom)',
  GlbPreviewPanel: ({ url }: { url: string }) => <div data-testid="glb-viewer-stub">{url}</div>,
}));

const POLL_MS = 5_000; // UI_TIMEOUTS.blenderGenPollInterval
const SUMMARY = 'fail (50) -> pass (100) · resolved: parts-over-budget';
const REFUSAL = 'mesh-finish resolves none of the failing criteria (floaters) — decimation does not remove floater specks';

function envelope(data: unknown): Response {
  return { json: async () => ({ success: true, data }) } as unknown as Response;
}

interface Call { url: string; init?: RequestInit }

/** Stub fetch by URL substring; every call is recorded in order. */
function stubFetch(routes: Record<string, () => unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    return envelope(key ? routes[key]() : {});
  }) as unknown as typeof fetch);
  return calls;
}

function seed(job: Partial<GenerationJob>): string {
  const full: GenerationJob = {
    id: 'forge-test-1',
    mode: 'text-to-3d',
    prompt: 'a wooden crate',
    providerId: 'tripo3d',
    status: 'completed',
    progress: 100,
    createdAt: 1,
    completedAt: 2,
    accepted: false,
    ungated: false,
    gateReason: 'Tier-1 gate FAIL (score 50)',
    assetClass: 'prop',
    meshPath: 'C:/pof/generated/tripo3d/crate.glb',
    ...job,
  };
  useForgeStore.setState({ jobs: [full] });
  return full.id;
}

const FINISH_REMEDY = {
  kind: 'finish' as const,
  paid: false as const,
  name: 'crate.glb',
  dir: 'tripo3d',
  addresses: ['parts-over-budget' as const],
  unaddressed: [],
  note: 'finishing addresses every failing criterion (parts-over-budget); the re-grade decides, not this plan',
};

const jobOf = (id: string) => useForgeStore.getState().jobs.find((j) => j.id === id);

beforeEach(() => {
  useForgeStore.setState({ jobs: [], promptHistory: [], activePolls: [] });
});

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('finishJob — the $0 remediate route, polled on the tracked rail', () => {
  it('case 7: POSTs remediate with basename + dir + class, polls to done, never touches /generate', async () => {
    vi.useFakeTimers();
    let polls = 0;
    const calls = stubFetch({
      '/api/visual-gen/mesh-finish/remediate': () => ({ routed: true, jobId: 'meshfinish-1' }),
      '/api/visual-gen/mesh-finish/status': () => (++polls < 2
        ? { status: 'running' }
        : {
            status: 'done',
            meshPath: 'C:/pof/generated/mesh-finish/crate_finish_1.glb',
            remediation: { improved: true, summary: SUMMARY },
          }),
    });
    const id = seed({ remedy: FINISH_REMEDY });

    await useForgeStore.getState().finishJob(id);
    expect(calls[0].url).toBe('/api/visual-gen/mesh-finish/remediate');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ name: 'crate.glb', dir: 'tripo3d', assetClass: 'prop' });
    // The finish poll is a tracked poll: visible and stoppable like a generation poll.
    expect(useForgeStore.getState().activePolls).toContain(id);

    await vi.advanceTimersByTimeAsync(POLL_MS);
    await vi.advanceTimersByTimeAsync(POLL_MS);

    const job = jobOf(id);
    expect(job?.finish?.state).toBe('done');
    if (job?.finish?.state !== 'done') throw new Error('unreachable');
    expect(job.finish.summary).toBe(SUMMARY);
    expect(calls.filter((c) => c.url.includes('/api/visual-gen/mesh-finish/status')).length).toBe(2);
    expect(calls.some((c) => c.url.includes('/api/visual-gen/generate'))).toBe(false);
    expect(useForgeStore.getState().activePolls).not.toContain(id);
  });

  it('case 8: a routed:false refusal lands verbatim and starts zero status polls', async () => {
    vi.useFakeTimers();
    const calls = stubFetch({
      '/api/visual-gen/mesh-finish/remediate': () => ({ routed: false, reason: REFUSAL }),
    });
    const id = seed({ remedy: FINISH_REMEDY });

    await useForgeStore.getState().finishJob(id);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);

    expect(jobOf(id)?.finish).toEqual({ state: 'refused', reason: REFUSAL });
    expect(calls.filter((c) => c.url.includes('/mesh-finish/status'))).toHaveLength(0);
    expect(useForgeStore.getState().activePolls).toHaveLength(0);
  });
});

describe('[guard] a reroll remedy never opens a new paid path', () => {
  it('case 9: renders the paid note with no button reaching /generate; retryJob on the completed job makes zero fetches', () => {
    const calls = stubFetch({});
    const id = seed({
      remedy: { kind: 'reroll', paid: true, addresses: ['empty-mesh'], note: 'another generation is paid' },
    });

    // The status==='failed' guard in retryJob is unchanged: a completed job cannot be retried.
    useForgeStore.getState().retryJob(id);
    expect(calls).toHaveLength(0);
    expect(jobOf(id)).toBeDefined();

    render(<GenerationQueue />);
    const note = screen.getByTestId('job-remedy-reroll');
    expect(note.textContent).toMatch(/paid/i);
    expect(screen.queryByTestId('job-finish-remedy')).toBeNull();

    const card = document.querySelector('[data-outcome="rejected"]') as HTMLElement;
    const buttons = within(card).queryAllByRole('button');
    // Remove last, so every other button on the card is pressed while the job exists.
    for (const b of [...buttons].reverse()) fireEvent.click(b);
    // Mounting the queue READS the MCP ledger (GET .../generate/jobs, never a submit); a paid
    // generation is only ever a POST to one of the two submit routes, and none is made.
    const submits = calls.filter((c) => /^\/api\/(visual-gen|blender-mcp)\/generate$/.test(c.url));
    expect(submits).toHaveLength(0);
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(0);
  });
});

describe('FinishRemedy on the card', () => {
  it('case 10: offers the $0 button, states a refusal verbatim, shows a done summary + finished preview, and a none reason', async () => {
    const calls = stubFetch({
      '/api/visual-gen/mesh-finish/remediate': () => ({ routed: false, reason: REFUSAL }),
    });
    const id = seed({ remedy: FINISH_REMEDY });
    const { rerender } = render(<GenerationQueue />);

    const button = screen.getByTestId('job-finish-remedy');
    expect(button.textContent).toMatch(/\$0/);
    await act(async () => { fireEvent.click(button); });
    const posts = calls.filter((c) => c.init?.method === 'POST');
    expect(posts.map((c) => c.url)).toEqual(['/api/visual-gen/mesh-finish/remediate']);
    expect(screen.getByTestId('job-finish-refused').textContent).toContain(REFUSAL);

    act(() => {
      useForgeStore.getState().updateJob(id, {
        finish: { state: 'done', summary: SUMMARY, improved: true, meshPath: 'C:/pof/generated/mesh-finish/crate_finish_1.glb' },
      });
    });
    rerender(<GenerationQueue />);
    expect(screen.getByTestId('job-finish-summary').textContent).toContain(SUMMARY);
    const previews = screen.getAllByTestId('glb-viewer-stub').map((n) => n.textContent);
    expect(previews.some((u) => u?.includes('crate_finish_1.glb') && u.includes('mesh-finish'))).toBe(true);

    act(() => {
      useForgeStore.getState().updateJob(id, {
        finish: undefined,
        remedy: { kind: 'none', reason: REFUSAL },
      });
    });
    rerender(<GenerationQueue />);
    expect(screen.queryByTestId('job-finish-remedy')).toBeNull();
    expect(screen.getByTestId('job-remedy-none').textContent).toContain('floater');
  });
});
