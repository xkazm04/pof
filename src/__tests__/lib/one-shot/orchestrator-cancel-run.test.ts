/**
 * image-generation/A - a pipeline run has a job identity. Cancel+resume or a double Run must not
 * leave two loops walking the same draft, and a cancelled run's late answers never land.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrchestrator, type OrchestratorStepRef } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';

const step = (label: string): OrchestratorStepRef =>
  ({ label, archetype: 'schema', tier: 'L0', view: { kind: 'table', field: 'rows', columns: [] } }) as OrchestratorStepRef;
const STEPS = ['Brief', 'Attributes', 'Economy'].map(step);
const envelope = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const DIST = { catalogId: 'items', total: 1, byAttribute: {}, underrepresented: [], sample: [] };
const tick = () => new Promise((r) => setTimeout(r, 0));

type Post = { url: string; body: Record<string, unknown> };
type Deferred = { resolve: (v: unknown) => void; signal?: AbortSignal; label: string };

/** Step requests the predicate selects hang until the test resolves them; everything else answers at once. */
function hangingFetch(hang: (label: string, nth: number) => boolean) {
  const posts: Post[] = [];
  const pending: Deferred[] = [];
  const seen = new Map<string, number>();
  const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    posts.push({ url, body });
    if (url === '/api/one-shot/step') {
      const label = body.stepLabel as string;
      const nth = (seen.get(label) ?? 0) + 1;
      seen.set(label, nth);
      if (hang(label, nth)) {
        return new Promise((resolve) => pending.push({ resolve, signal: init?.signal ?? undefined, label }));
      }
      return Promise.resolve(envelope({ outcome: 'pass' }));
    }
    return Promise.resolve(envelope(body));
  });
  return { posts, pending, fetchImpl: fetchImpl as unknown as typeof fetch };
}
const stepLabels = (posts: Post[]) => posts.filter((p) => p.url === '/api/one-shot/step').map((p) => p.body.stepLabel);

function seedInterrupted() {
  useOneShotJobStore.setState({
    phase: 'failed', failureReason: 'reload-interrupted', catalogId: 'items', jobId: 'job-1',
    draftEntityId: 'draft-items-1', stepResults: [], totalSteps: 3,
  });
}

describe('one-shot orchestrator - run epoch', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('cancel then resume: the old loop, once its fetch resolves, dispatches and records nothing', async () => {
    seedInterrupted();
    const h = hangingFetch((label, nth) => label === 'Brief' && nth === 1);
    const orch = createOrchestrator({ fetchImpl: h.fetchImpl, stepsFor: () => STEPS });
    const completed = vi.fn();
    const off = eventBus.on('oneshot.step-completed', completed);

    const oldRun = orch.resume();
    await tick();
    expect(h.pending).toHaveLength(1);
    orch.cancel();
    await orch.resume();
    const afterResume = completed.mock.calls.length;

    h.pending[0].resolve(envelope({ outcome: 'pass' }));
    await oldRun;
    await tick();
    off();

    expect(completed.mock.calls.length).toBe(afterResume);
    const labels = stepLabels(h.posts);
    expect(labels.filter((l) => l === 'Attributes')).toHaveLength(1);
    expect(labels.filter((l) => l === 'Economy')).toHaveLength(1);
    const recorded = useOneShotJobStore.getState().stepResults.map((r) => r.step);
    expect(new Set(recorded).size).toBe(recorded.length);
    expect(recorded).toEqual(['Brief', 'Attributes', 'Economy']);
  });

  it('cancel() while running aborts the in-flight step request', async () => {
    seedInterrupted();
    const h = hangingFetch((label) => label === 'Brief');
    const orch = createOrchestrator({ fetchImpl: h.fetchImpl, stepsFor: () => STEPS });
    const run = orch.resume();
    await tick();
    expect(h.pending[0].signal).toBeDefined();
    expect(h.pending[0].signal!.aborted).toBe(false);
    orch.cancel();
    expect(h.pending[0].signal!.aborted).toBe(true);
    h.pending[0].resolve(envelope({ outcome: 'pass' }));
    await run;
  });

  it('a stale result records nothing and emits no step-completed/completed; failed is emitted once', async () => {
    seedInterrupted();
    const h = hangingFetch((label) => label === 'Brief');
    const orch = createOrchestrator({ fetchImpl: h.fetchImpl, stepsFor: () => STEPS });
    const events: string[] = [];
    const offs = (['oneshot.step-completed', 'oneshot.completed', 'oneshot.failed'] as const)
      .map((n) => eventBus.on(n, () => { events.push(n); }));
    const run = orch.resume();
    await tick();
    orch.cancel();
    h.pending[0].resolve(envelope({ outcome: 'pass' }));
    await run;
    offs.forEach((o) => o());

    expect(events).toEqual(['oneshot.failed']);
    const st = useOneShotJobStore.getState();
    expect(st.stepResults).toEqual([]);
    expect(st.phase).toBe('failed');
    expect(st.failureReason).toBe('cancelled');
    expect(stepLabels(h.posts)).toEqual(['Brief']);
  });

  it('approveAndRun twice before the persist resolves: the second rejects, one draft, one POST', async () => {
    useOneShotJobStore.setState({
      phase: 'proposing', catalogId: 'items', jobId: 'job-2',
      proposal: { name: 'Blade', data: {}, rationale: 'r' },
    });
    let release!: (v: unknown) => void;
    const posts: string[] = [];
    const fetchImpl = vi.fn((url: string) => {
      posts.push(url);
      if (url === '/api/catalog-entities') return new Promise((r) => { release = r; });
      return Promise.resolve(envelope({ outcome: 'pass' }));
    });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch, stepsFor: () => STEPS });

    const first = orch.approveAndRun();
    const second = orch.approveAndRun();
    await expect(second).rejects.toThrow(/already/);
    release(envelope({}));
    await first;

    expect(posts.filter((u) => u === '/api/catalog-entities')).toHaveLength(1);
    const drafts = Object.values(useCatalogStore.getState().draftEntitiesByCatalog).flat();
    expect(drafts).toHaveLength(1);
    expect(posts.filter((u) => u === '/api/one-shot/step')).toHaveLength(3);
  });

  it('[guard] cancel() while analyzing: idle/cancelled, the late answer rejects and writes nothing', async () => {
    let answer!: (v: unknown) => void;
    const fetchImpl = vi.fn(() => new Promise((r) => { answer = r; }));
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const pending = orch.analyze('items');
    orch.cancel();
    expect(useOneShotJobStore.getState().phase).toBe('idle');
    expect(useOneShotJobStore.getState().failureReason).toBe('cancelled');
    answer(envelope(DIST));
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(useOneShotJobStore.getState().distribution).toBeNull();
  });
});
