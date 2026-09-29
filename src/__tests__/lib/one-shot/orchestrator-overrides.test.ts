/**
 * catalog-pipelines/B — the run plan's per-step author choice is a STORE fact the orchestrator
 * reads for every run path: an override reaches the step route's `mode`, the untouched steps
 * keep today's default, and a resumed run sends the same modes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrchestrator, type OrchestratorStepRef } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';

const STEPS: OrchestratorStepRef[] = [
  { label: 'Concept & Role', archetype: 'brief', tier: 'L0', view: { kind: 'prose', field: 'concept', emptyText: '' } },
  { label: 'Stat Block', archetype: 'schema', tier: 'L0', view: { kind: 'table', field: 'stats', columns: [] } },
  { label: 'Behavior (NPC)', archetype: 'rules', tier: 'L0', view: { kind: 'table', field: 'behavior', columns: [] } },
] as OrchestratorStepRef[];

type Call = { url: string; body: Record<string, unknown> };

function recordingFetch() {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    calls.push({ url, body });
    const data = url === '/api/one-shot/step' ? { outcome: 'pass' } : body;
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const modesByStep = (calls: Call[]) =>
  Object.fromEntries(calls.filter((c) => c.url === '/api/one-shot/step').map((c) => [c.body.stepLabel, c.body.mode]));

describe('one-shot step-mode overrides', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('setStepMode records the override; reset() clears it', () => {
    useOneShotJobStore.getState().setStepMode('Behavior (NPC)', 'cli');
    expect(useOneShotJobStore.getState().stepModeOverrides['Behavior (NPC)']).toBe('cli');
    useOneShotJobStore.getState().reset();
    expect(useOneShotJobStore.getState().stepModeOverrides).toEqual({});
  });

  it('setStepMode(label, null) clears one override', () => {
    const st = useOneShotJobStore.getState();
    st.setStepMode('Behavior (NPC)', 'cli');
    st.setStepMode('Behavior (NPC)', null);
    expect(useOneShotJobStore.getState().stepModeOverrides).toEqual({});
  });

  it('approveAndRun sends the override as mode cli; untouched steps keep their default', async () => {
    useOneShotJobStore.setState({
      phase: 'proposing', catalogId: 'characters',
      proposal: { name: 'Goblin Shaman', rationale: 'r', data: {} },
    });
    useOneShotJobStore.getState().setStepMode('Behavior (NPC)', 'cli');
    const { calls, fetchImpl } = recordingFetch();
    await createOrchestrator({ fetchImpl, stepsFor: () => STEPS }).approveAndRun();
    expect(modesByStep(calls)).toEqual({ 'Concept & Role': 'cli', 'Stat Block': 'deterministic', 'Behavior (NPC)': 'cli' });
  });

  it('resume() after an interruption sends the same modes', async () => {
    useOneShotJobStore.setState({
      phase: 'failed', failureReason: 'reload-interrupted', catalogId: 'characters', jobId: 'job-1',
      draftEntityId: 'draft-characters-1', totalSteps: 3,
      stepResults: [{ step: 'Concept & Role', outcome: 'pass' }],
    });
    useOneShotJobStore.getState().setStepMode('Behavior (NPC)', 'cli');
    const { calls, fetchImpl } = recordingFetch();
    await createOrchestrator({ fetchImpl, stepsFor: () => STEPS }).resume();
    expect(modesByStep(calls)).toEqual({ 'Stat Block': 'deterministic', 'Behavior (NPC)': 'cli' });
  });

  it('[guard] no override: Behavior (NPC) stays deterministic (default spend unchanged)', async () => {
    useOneShotJobStore.setState({
      phase: 'proposing', catalogId: 'characters',
      proposal: { name: 'Goblin Shaman', rationale: 'r', data: {} },
    });
    const { calls, fetchImpl } = recordingFetch();
    await createOrchestrator({ fetchImpl, stepsFor: () => STEPS }).approveAndRun();
    expect(modesByStep(calls)['Behavior (NPC)']).toBe('deterministic');
  });
});
