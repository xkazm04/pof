import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrchestrator, type OrchestratorStepRef } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';

function mockFetch(routes: Record<string, (body?: unknown) => unknown>) {
  // `approveAndRun` now persists the draft server-side FIRST (durable catalog entities), so
  // every run reaches this route. It is answered by default and overridable per test, which
  // keeps the pre-existing cases exercising the SUCCESSFUL persist path rather than silently
  // drifting onto the browser-only fallback.
  const all: Record<string, (body?: unknown) => unknown> = {
    '/api/catalog-entities': (b) => ({ ...(b as object), source: 'one-shot' }),
    ...routes,
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const fn = all[url];
    if (!fn) return { ok: false, status: 404, json: async () => ({ success: false, error: 'no route' }) };
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const data = fn(body);
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
}

const ONE_STEP: OrchestratorStepRef[] = [{ label: 'Attributes', archetype: 'schema', tier: 'L0', view: { kind: 'table', field: 'rows', columns: [{ key: 'name' }] } }];

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

  it('persists the draft server-side BEFORE any artifact is produced for it', async () => {
    useOneShotJobStore.getState().setPhase('proposing', { catalogId: 'items' });
    useOneShotJobStore.getState().setProposal({ name: 'Iron Hatchet', data: { type: 'Weapon' }, rationale: 'r' });
    const calls: string[] = [];
    const fetchImpl = mockFetch({
      '/api/catalog-entities': (b) => { calls.push('persist'); return b; },
      '/api/one-shot/step': () => { calls.push('step'); return { outcome: 'pass' }; },
    });
    const orch = createOrchestrator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      stepsFor: () => ONE_STEP,
    });
    await orch.approveAndRun();

    expect(calls).toEqual(['persist', 'step']);
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ catalogId: 'items', name: 'Iron Hatchet', source: 'one-shot' });
    expect(body.entityId).toMatch(/^draft-items-/);

    // A successful persist leaves NO browser-only flag: the store is a cache of the server row.
    const id = useOneShotJobStore.getState().draftEntityId!;
    expect(useCatalogStore.getState().draftEntitiesByCatalog.items?.[id]?.browserOnly).toBeUndefined();
  });

  it('a failed persist flags the draft browser-only WITH the reason — never a silent fallback', async () => {
    useOneShotJobStore.getState().setPhase('proposing', { catalogId: 'items' });
    useOneShotJobStore.getState().setProposal({ name: 'X', data: { type: 'Weapon' }, rationale: 'r' });
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === '/api/catalog-entities') {
        return { ok: false, status: 500, json: async () => ({ success: false, error: 'catalog_entities unwritable' }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: { outcome: 'pass' } }) };
    });
    const orch = createOrchestrator({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      stepsFor: () => ONE_STEP,
    });
    await orch.approveAndRun();

    const id = useOneShotJobStore.getState().draftEntityId!;
    const draft = useCatalogStore.getState().draftEntitiesByCatalog.items?.[id];
    expect(draft?.browserOnly).toBe(true);
    expect(draft?.persistError).toContain('catalog_entities unwritable');
    // The approved run still completes — the flag is the disclosure, not a silent abort.
    expect(useOneShotJobStore.getState().phase).toBe('completed');
  });

  // ── catalog-gap-analysis/B: gap-first flow — analyze stops, the operator picks the target ──
  const ITEMS_DIST = {
    catalogId: 'items', total: 100,
    byAttribute: { rarity: { Common: 34, Rare: 66 }, type: { Weapon: 75, Armor: 25 } },
    underrepresented: [
      { attribute: 'rarity', value: 'Common', count: 34, expected: 57 },
      { attribute: 'type', value: 'Armor', count: 25, expected: 43 },
    ],
    sample: [], gapBasis: 'expected-share',
  };
  const PROPOSAL = { name: 'Worn Tunic', data: { type: 'Armor', rarity: 'Common' }, rationale: 'fills Common' };
  const bodyOf = (f: ReturnType<typeof vi.fn>, url: string) =>
    JSON.parse((f.mock.calls.find((c) => c[0] === url)![1] as RequestInit).body as string);

  it('analyze stops at phase analyzed with the distribution stored — no LLM run is spawned', async () => {
    const fetchImpl = mockFetch({ '/api/one-shot/analyze': () => ITEMS_DIST, '/api/one-shot/propose': () => PROPOSAL });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.analyze('items');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/one-shot/analyze');
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('analyzed');
    expect(st.catalogId).toBe('items');
    expect(st.distribution).toEqual(ITEMS_DIST);
    expect(fetchImpl.mock.calls.some((c) => c[0] === '/api/one-shot/propose')).toBe(false);
  });

  it('proposeFor(target) from analyzed posts the picked target + the stored distribution', async () => {
    const fetchImpl = mockFetch({ '/api/one-shot/analyze': () => ITEMS_DIST, '/api/one-shot/propose': () => PROPOSAL });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.analyze('items');
    const target = { catalogId: 'items', attribute: 'type', value: 'Armor', count: 25, expected: 43, deficit: 18 };
    await orch.proposeFor(target);
    const body = bodyOf(fetchImpl, '/api/one-shot/propose');
    expect(body.target).toEqual(target);
    expect(body.distribution).toEqual(ITEMS_DIST);
    expect(body.catalogId).toBe('items');
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('proposing');
    expect(st.proposal).toEqual(PROPOSAL);
    expect(st.target).toEqual(target);
  });

  it('refine sends the stored distribution the refine route requires', async () => {
    const REFINED = { ...PROPOSAL, name: 'Threadbare Tunic' };
    const fetchImpl = mockFetch({
      '/api/one-shot/analyze': () => ITEMS_DIST,
      '/api/one-shot/propose': () => PROPOSAL,
      '/api/one-shot/refine': () => REFINED,
    });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.start('items');
    await orch.refine('make it rarer');
    const body = bodyOf(fetchImpl, '/api/one-shot/refine');
    expect(body.distribution).toEqual(ITEMS_DIST);
    expect(body).toMatchObject({ catalogId: 'items', prior: PROPOSAL, userInput: 'make it rarer' });
    expect(useOneShotJobStore.getState().proposal?.name).toBe('Threadbare Tunic');
    expect(useOneShotJobStore.getState().phase).toBe('proposing');
  });

  it('a failed propose returns to analyzed (distribution kept), never a stuck in-flight phase', async () => {
    const fetchImpl = vi.fn(async (url: string) => url === '/api/one-shot/analyze'
      ? { ok: true, status: 200, json: async () => ({ success: true, data: ITEMS_DIST }) }
      : { ok: false, status: 500, json: async () => ({ success: false, error: 'cli timed out' }) });
    const orch = createOrchestrator({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await orch.analyze('items');
    await expect(orch.proposeFor(null)).rejects.toThrow(/cli timed out/);
    const st = useOneShotJobStore.getState();
    expect(st.phase).toBe('analyzed');
    expect(st.distribution).toEqual(ITEMS_DIST);
  });

  it('refuses to start when not in idle/completed/failed', async () => {
    useOneShotJobStore.getState().setPhase('running');
    const orch = createOrchestrator({ fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(orch.start('items')).rejects.toThrow(/another one-shot is in flight/i);
  });
});
