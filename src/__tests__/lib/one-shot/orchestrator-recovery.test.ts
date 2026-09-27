/**
 * image-generation/B — one-shot recovery modes. A run is not single-use: an interrupted run
 * RESUMES at the first unrecorded step on the same draft, failed steps are RETRIED in place,
 * and every in-flight phase can be CANCELLED back to a resting phase (a late answer from the
 * cancelled request never lands).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrchestrator, type OrchestratorStepRef } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore, type StepResult } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';

const step = (label: string): OrchestratorStepRef =>
  ({ label, archetype: 'schema', tier: 'L0', view: { kind: 'table', field: 'rows', columns: [] } }) as OrchestratorStepRef;

const FIVE = ['Brief', 'Attributes', 'Economy', 'Lore', 'Balance'].map(step);

type Call = { url: string; body: Record<string, unknown> };

function recordingFetch(stepOutcome: (label: string) => 'pass' | 'fail' = () => 'pass') {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    calls.push({ url, body });
    const data = url === '/api/one-shot/step' ? { outcome: stepOutcome(body.stepLabel) } : body;
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const stepPosts = (calls: Call[]) => calls.filter((c) => c.url === '/api/one-shot/step');
const envelope = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const DIST = { catalogId: 'items', total: 1, byAttribute: {}, underrepresented: [], sample: [] };

describe('one-shot orchestrator — recovery modes', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('[guard] a rejected analyze leaves a resting phase with the reason, and a new start is allowed', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: 'boom' }) }));
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(orch.start('items')).rejects.toThrow(/boom/);
    const st = useOneShotJobStore.getState();
    expect(['idle', 'failed']).toContain(st.phase);
    expect(st.failureReason).toContain('boom');
    expect(st.canStart()).toBe(true);
  });

  it('resume() runs only the unrecorded steps on the SAME draft - no entity POST, no second addDraft', async () => {
    const recorded: StepResult[] = [{ step: 'Brief', outcome: 'pass' }, { step: 'Attributes', outcome: 'pass' }];
    useOneShotJobStore.setState({
      phase: 'failed', failureReason: 'reload-interrupted', catalogId: 'items', jobId: 'job-1',
      draftEntityId: 'draft-items-1', stepResults: recorded, totalSteps: 5,
    });
    const addDraft = vi.fn();
    useCatalogStore.setState({ addDraft });
    const { calls, fetchImpl } = recordingFetch();
    const orch = createOrchestrator({ fetchImpl, stepsFor: () => FIVE });

    await orch.resume();

    const posts = stepPosts(calls);
    expect(posts.map((c) => c.body.stepLabel)).toEqual(['Economy', 'Lore', 'Balance']);
    expect(posts.every((c) => c.body.entityId === 'draft-items-1')).toBe(true);
    expect(calls.filter((c) => c.url === '/api/catalog-entities')).toHaveLength(0);
    expect(addDraft).not.toHaveBeenCalled();
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('completed');
    expect(st.stepResults.map((r) => r.step)).toEqual(['Brief', 'Attributes', 'Economy', 'Lore', 'Balance']);
    expect(st.failureReason).toBeUndefined();
  });

  it('resume() refuses when there is no draft to resume', async () => {
    useOneShotJobStore.setState({ phase: 'failed', failureReason: 'reload-interrupted', catalogId: 'items', draftEntityId: null });
    const { fetchImpl } = recordingFetch();
    const orch = createOrchestrator({ fetchImpl, stepsFor: () => FIVE });
    await expect(orch.resume()).rejects.toThrow(/nothing to resume/i);
  });

  it('retryFailed() re-runs only the failed steps and replaces them IN PLACE', async () => {
    useOneShotJobStore.setState({
      phase: 'completed', catalogId: 'items', jobId: 'job-2', draftEntityId: 'draft-items-2',
      stepResults: [
        { step: 'A', outcome: 'pass' }, { step: 'B', outcome: 'fail', reason: 'x' },
        { step: 'C', outcome: 'pass' }, { step: 'D', outcome: 'fail', reason: 'y' },
      ],
      totalSteps: 4,
      lastSummary: { ran: 4, passed: 2, failed: 2, skipped: 0, deferred: 0 },
    });
    const { calls, fetchImpl } = recordingFetch((label) => (label === 'B' ? 'pass' : 'fail'));
    const orch = createOrchestrator({ fetchImpl, stepsFor: () => ['A', 'B', 'C', 'D'].map(step) });

    await orch.retryFailed();

    expect(stepPosts(calls).map((c) => c.body.stepLabel)).toEqual(['B', 'D']);
    expect(calls.filter((c) => c.url === '/api/catalog-entities')).toHaveLength(0);
    const st = useOneShotJobStore.getState();
    expect(st.stepResults.map((r) => `${r.step}:${r.outcome}`)).toEqual(['A:pass', 'B:pass', 'C:pass', 'D:fail']);
    expect(st.phase).toBe('completed');
    expect(st.lastSummary).toEqual({ ran: 4, passed: 3, failed: 1, skipped: 0, deferred: 0 });
  });

  it('retryFailed() on an interrupted run keeps it failed (still resumable) when steps remain unrecorded', async () => {
    useOneShotJobStore.setState({
      phase: 'failed', failureReason: 'reload-interrupted', catalogId: 'items', jobId: 'job-3',
      draftEntityId: 'draft-items-3', stepResults: [{ step: 'Brief', outcome: 'fail' }], totalSteps: 5,
    });
    const { calls, fetchImpl } = recordingFetch();
    const orch = createOrchestrator({ fetchImpl, stepsFor: () => FIVE });
    await orch.retryFailed();
    expect(stepPosts(calls).map((c) => c.body.stepLabel)).toEqual(['Brief']);
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('failed');
    expect(st.failureReason).toBe('reload-interrupted');
    expect(st.stepResults).toEqual([{ step: 'Brief', outcome: 'pass' }]);
  });

  it('cancel() while analyzing returns to idle and the late analyze answer never lands', async () => {
    let answer!: (v: unknown) => void;
    const fetchImpl = vi.fn(() => new Promise((r) => { answer = r; }));
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const pending = orch.analyze('items');
    expect(useOneShotJobStore.getState().phase).toBe('analyzing');
    const failed = vi.fn();
    const off = eventBus.on('oneshot.failed', failed);

    orch.cancel();
    expect(useOneShotJobStore.getState().phase).toBe('idle');
    expect(useOneShotJobStore.getState().failureReason).toBe('cancelled');
    expect(useOneShotJobStore.getState().canStart()).toBe(true);

    answer(envelope(DIST));
    await expect(pending).rejects.toThrow(/cancelled/);
    off();
    expect(useOneShotJobStore.getState().phase).toBe('idle');
    expect(useOneShotJobStore.getState().distribution).toBeNull();
    expect(failed).not.toHaveBeenCalled();
  });

  it('cancel() while proposing returns to analyzed (distribution kept) and drops the late proposal', async () => {
    let answer!: (v: unknown) => void;
    const fetchImpl = vi.fn((url: string) => url === '/api/one-shot/analyze'
      ? Promise.resolve(envelope(DIST))
      : new Promise((r) => { answer = r; }));
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.analyze('items');
    const pending = orch.proposeFor(null);
    expect(useOneShotJobStore.getState().phase).toBe('proposing');

    orch.cancel();
    expect(useOneShotJobStore.getState().phase).toBe('analyzed');
    answer(envelope({ name: 'Late', data: {}, rationale: 'r' }));
    await expect(pending).rejects.toThrow(/cancelled/);
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('analyzed');
    expect(st.proposal).toBeNull();
    expect(st.distribution).toEqual(DIST);
  });
});
