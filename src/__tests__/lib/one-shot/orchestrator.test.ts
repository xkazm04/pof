import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrchestrator } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';

function mockFetch(routes: Record<string, (body?: unknown) => unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const fn = routes[url];
    if (!fn) return { ok: false, status: 404, json: async () => ({ success: false, error: 'no route' }) };
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const data = fn(body);
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
}

describe('orchestrator', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('start: analyzing → proposing on successful analyze + propose', async () => {
    const fetchImpl = mockFetch({
      '/api/one-shot/analyze':
        () => ({ catalogId: 'items', total: 1, byAttribute: {}, underrepresented: [], sample: [] }),
      '/api/one-shot/propose':
        () => ({ name: 'Iron Hatchet', data: { type: 'Weapon', subtype: 'Axe', rarity: 'Common' }, rationale: 'fills the axe gap' }),
    });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.start('items');
    expect(useOneShotJobStore.getState().phase).toBe('proposing');
    expect(useOneShotJobStore.getState().proposal?.name).toBe('Iron Hatchet');
  });

  it('approveAndRun creates a draft entity + transitions to running', async () => {
    useOneShotJobStore.getState().setPhase('proposing', { catalogId: 'items' });
    useOneShotJobStore.getState().setProposal({ name: 'X', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'r' });
    const fetchImpl = mockFetch({
      '/api/one-shot/step': (b: unknown) => ({ outcome: 'pass', stepName: (b as { stepLabel: string }).stepLabel }),
    });
    const orch = createOrchestrator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      stepsFor: () => [{ label: 'Attributes', archetype: 'schema', tier: 'L0', view: { kind: 'table' } }] as any,
    });
    await orch.approveAndRun();
    const st = useOneShotJobStore.getState();
    expect(st.draftEntityId).toMatch(/^draft-items-/);
    expect(useCatalogStore.getState().draftEntitiesByCatalog.items?.[st.draftEntityId!]?.name).toBe('X');
    expect(st.phase).toBe('completed');
    expect(st.lastSummary).toMatchObject({ passed: 1, failed: 0, skipped: 0, deferred: 0 });
  });

  it('emits oneshot.started / step-completed / completed', async () => {
    useOneShotJobStore.getState().setPhase('proposing', { catalogId: 'items' });
    useOneShotJobStore.getState().setProposal({ name: 'X', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'r' });
    const events: string[] = [];
    const u1 = eventBus.on('oneshot.started', () => events.push('started'));
    const u2 = eventBus.on('oneshot.step-completed', () => events.push('step'));
    const u3 = eventBus.on('oneshot.completed', () => events.push('completed'));
    const fetchImpl = mockFetch({
      '/api/one-shot/step': () => ({ outcome: 'pass', stepName: 'Attributes' }),
    });
    const orch = createOrchestrator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      stepsFor: () => [{ label: 'Attributes', archetype: 'schema', tier: 'L0', view: { kind: 'table' } }] as any,
    });
    await orch.approveAndRun();
    u1(); u2(); u3();
    expect(events).toEqual(['started', 'step', 'completed']);
  });

  it('continues + summarizes on step failure', async () => {
    useOneShotJobStore.getState().setPhase('proposing', { catalogId: 'items' });
    useOneShotJobStore.getState().setProposal({ name: 'X', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'r' });
    let call = 0;
    const fetchImpl = mockFetch({
      '/api/one-shot/step': () => ({ outcome: ++call === 1 ? 'fail' : 'pass', stepName: `s${call}` }),
    });
    const orch = createOrchestrator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      stepsFor: () => [
        { label: 's1', archetype: 'schema', tier: 'L0', view: { kind: 'table' } },
        { label: 's2', archetype: 'schema', tier: 'L0', view: { kind: 'table' } },
      ] as any,
    });
    await orch.approveAndRun();
    expect(useOneShotJobStore.getState().lastSummary).toEqual({ ran: 2, passed: 1, failed: 1, skipped: 0, deferred: 0 });
  });

  it('refuses to start when not in idle/completed/failed', async () => {
    useOneShotJobStore.getState().setPhase('running');
    const orch = createOrchestrator({ fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(orch.start('items')).rejects.toThrow(/another one-shot is in flight/i);
  });
});
