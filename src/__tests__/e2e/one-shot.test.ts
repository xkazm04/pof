/**
 * E2E happy-path test for the one-shot catalog-row orchestrator.
 *
 * The CLI layer is mocked via the `fetchImpl` + `stepsFor` injection points
 * on `createOrchestrator`; the real orchestrator state machine and event bus
 * are exercised end-to-end without starting a real HTTP server.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestrator } from '@/lib/one-shot/orchestrator';
import type { OrchestratorStepRef } from '@/lib/one-shot/orchestrator';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';
import type { EventMap } from '@/types/event-bus';

// ─── fixtures ───────────────────────────────────────────────────────────────

const DISTRIBUTION = {
  catalogId: 'items',
  total: 5,
  byAttribute: { rarity: { Common: 4, Uncommon: 1 } },
  underrepresented: ['Uncommon'],
  sample: [],
};

/** A valid items proposal that passes `validateProposal('items', …)`. */
const PROPOSAL = {
  name: 'Thornwood Wand',
  data: { type: 'Weapon', rarity: 'Uncommon' },
  rationale: 'fills the Uncommon Weapon gap in the items catalog',
};

/**
 * A representative step list covering every skip-policy branch:
 *  - gallery → skipped
 *  - tier L3  → deferred
 *  - tier L4  → deferred
 *  - brief     → run-cli   (POST /api/one-shot/step)
 *  - schema    → run-deterministic (POST /api/one-shot/step)
 *
 * ViewDescriptor fields beyond `kind` are not used by the orchestrator's
 * skip-policy decision, so we cast to satisfy the type while keeping the
 * fixture minimal.
 */
const REPRESENTATIVE_STEPS: OrchestratorStepRef[] = [
  { label: 'Icon 2D Art',        archetype: 'gallery', tier: 'L1', view: { kind: 'gallery', field: 'icon', candidates: 4 } },
  { label: 'Runtime Test',       archetype: 'schema',  tier: 'L3', view: { kind: 'table',   field: 'rt', columns: [] } },
  { label: 'Visual Gate',        archetype: 'schema',  tier: 'L4', view: { kind: 'table',   field: 'vg', columns: [] } },
  { label: 'Concept Brief',      archetype: 'brief',   tier: 'L0', view: { kind: 'prose',   field: 'brief', emptyText: '' } },
  { label: 'Base Type & Rarity', archetype: 'schema',  tier: 'L0', view: { kind: 'table',   field: 'baseType', columns: [] } },
];

// ─── fetch mock helper ───────────────────────────────────────────────────────

type RouteHandler = (body?: unknown) => unknown;

function mockFetch(routes: Record<string, RouteHandler>): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const fn = routes[url];
    if (!fn) {
      return { ok: false, status: 404, json: async () => ({ success: false, error: `no route: ${url}` }) };
    }
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const data = fn(body);
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  }) as typeof fetch;
}

function stepHandler(b: unknown): { outcome: 'pass'; stepName: string } {
  return { outcome: 'pass', stepName: (b as { stepLabel: string }).stepLabel };
}

function standardRoutes(overrides: Partial<Record<string, RouteHandler>> = {}): Record<string, RouteHandler> {
  return {
    '/api/one-shot/analyze': () => DISTRIBUTION,
    '/api/one-shot/propose': () => PROPOSAL,
    '/api/one-shot/refine':  () => PROPOSAL,
    '/api/one-shot/step':    stepHandler,
    ...overrides,
  };
}

// ─── setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useOneShotJobStore.getState().reset();
  localStorage.removeItem('pof-one-shot-job');
  localStorage.removeItem('pof-catalog-store');
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe('one-shot E2E (mocked CLI)', () => {
  it('happy path runs all enabled steps and emits oneshot.completed', async () => {
    const completedPayloads: Array<EventMap['oneshot.completed']> = [];
    const unsub = eventBus.on('oneshot.completed', (e) => completedPayloads.push(e.payload));

    const orch = createOrchestrator({
      fetchImpl: mockFetch(standardRoutes()),
      stepsFor: () => REPRESENTATIVE_STEPS,
    });

    await orch.start('items');
    await orch.approveAndRun();

    unsub();

    // oneshot.completed fired exactly once
    expect(completedPayloads).toHaveLength(1);
    const payload = completedPayloads[0];

    // passed > 0  (brief + schema ran and the mock returns 'pass')
    expect(payload.passed).toBeGreaterThan(0);
    // failed === 0
    expect(payload.failed).toBe(0);
    // skipped >= 1 (gallery step)
    expect(payload.skipped).toBeGreaterThanOrEqual(1);
    // deferred >= 1 (L3 + L4 steps)
    expect(payload.deferred).toBeGreaterThanOrEqual(1);

    // store phase is 'completed'
    expect(useOneShotJobStore.getState().phase).toBe('completed');

    // a draft entity was added for 'items'
    const drafts = useCatalogStore.getState().draftEntitiesByCatalog['items'];
    expect(drafts).toBeDefined();
    const draftValues = Object.values(drafts ?? {});
    expect(draftValues.length).toBeGreaterThan(0);
    expect(draftValues[0].name).toBe(PROPOSAL.name);
  });

  it('refinement up to 3 turns — 4th blocked unless forceMore', async () => {
    const orch = createOrchestrator({
      fetchImpl: mockFetch(standardRoutes()),
      stepsFor: () => REPRESENTATIVE_STEPS,
    });

    await orch.start('items');
    // store is now in 'proposing'
    expect(useOneShotJobStore.getState().phase).toBe('proposing');

    // 3 refinement turns succeed
    await orch.refine('make it more unique');
    await orch.refine('sharper name please');
    await orch.refine('final tweak');

    expect(useOneShotJobStore.getState().refinementTurns).toBe(3);
    expect(useOneShotJobStore.getState().phase).toBe('proposing');

    // 4th turn without forceMore is blocked
    await expect(orch.refine('one more')).rejects.toThrow(/turn cap/i);

    // still at 3 turns in the store
    expect(useOneShotJobStore.getState().refinementTurns).toBe(3);

    // forceMore=true bypasses the cap
    await orch.refine('forced extra', true);
    expect(useOneShotJobStore.getState().refinementTurns).toBe(4);
  });

  it('failed step does not abort the loop — final phase is completed, failed:1', async () => {
    let callIndex = 0;
    const orch = createOrchestrator({
      fetchImpl: mockFetch(standardRoutes({
        '/api/one-shot/step': (b: unknown) => {
          callIndex++;
          // First /step call (the brief CLI step) returns fail
          if (callIndex === 1) return { outcome: 'fail', reason: 'CLI error: timeout' };
          return stepHandler(b);
        },
      })),
      stepsFor: () => REPRESENTATIVE_STEPS,
    });

    const completedPayloads: Array<EventMap['oneshot.completed']> = [];
    const unsub = eventBus.on('oneshot.completed', (e) => completedPayloads.push(e.payload));

    await orch.start('items');
    await orch.approveAndRun();

    unsub();

    // orchestrator continues + summarizes: still completes
    expect(useOneShotJobStore.getState().phase).toBe('completed');

    // exactly one completed event
    expect(completedPayloads).toHaveLength(1);
    // failed:1 in the payload
    expect(completedPayloads[0].failed).toBe(1);
    // other ran steps still recorded
    expect(completedPayloads[0].passed).toBeGreaterThan(0);
  });

  it('cancel() mid-run ends with phase=failed and failureReason=cancelled', async () => {
    let resolveStep: (v: unknown) => void;
    /** The step mock pauses on the first call until `resolveStep` is invoked. */
    const blockedStepFetch = (async (url: string, init?: RequestInit) => {
      if (url === '/api/one-shot/step') {
        await new Promise((res) => { resolveStep = res; });
        return { ok: true, status: 200, json: async () => ({ success: true, data: { outcome: 'pass' } }) };
      }
      // All other routes resolve immediately
      const handler = standardRoutes()[url];
      if (!handler) return { ok: false, status: 404, json: async () => ({ success: false, error: `no route: ${url}` }) };
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      return { ok: true, status: 200, json: async () => ({ success: true, data: handler(body) }) };
    }) as typeof fetch;

    const orch = createOrchestrator({
      fetchImpl: blockedStepFetch,
      stepsFor: () => [
        // Only runnable steps that will hit the blocked fetch
        { label: 'Concept Brief', archetype: 'brief',  tier: 'L0', view: { kind: 'prose',  field: 'brief',     emptyText: '' } },
        { label: 'Attributes',    archetype: 'schema', tier: 'L0', view: { kind: 'table',  field: 'baseType',  columns: [] } },
      ] as OrchestratorStepRef[],
    });

    await orch.start('items');

    // Start run, then cancel before the blocked step resolves
    const runPromise = orch.approveAndRun();
    // Cancel synchronously — sets _cancelled flag and phase=failed
    orch.cancel();
    // Unblock the pending step fetch so the loop can exit
    resolveStep!(undefined);

    await runPromise;

    expect(useOneShotJobStore.getState().phase).toBe('failed');
    expect(useOneShotJobStore.getState().failureReason).toBe('cancelled');
  });
});
