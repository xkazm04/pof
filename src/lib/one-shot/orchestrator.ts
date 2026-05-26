'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';
import { decide } from './skip-policy';
import type { ArchetypeId, ViewDescriptor, AcceptanceTier } from './types';

export interface OrchestratorStepRef {
  label: string;
  archetype: ArchetypeId;
  tier: AcceptanceTier;
  view: ViewDescriptor;
  autoMode?: 'cli' | 'deterministic' | 'skip';
}

export interface OrchestratorOptions {
  fetchImpl?: typeof fetch;
  /** Provide steps for a catalog. Default reads from the registered StepSpec pipeline. */
  stepsFor?: (catalogId: string) => OrchestratorStepRef[];
}

export interface Orchestrator {
  start(catalogId: string, userHint?: string): Promise<void>;
  refine(userInput: string, forceMore?: boolean): Promise<void>;
  approveAndRun(): Promise<void>;
  cancel(): void;
}

function mkJobId(): string {
  return `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function defaultStepsFor(catalogId: string): OrchestratorStepRef[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reg = require('@/lib/catalog/pipeline-registry') as {
    getCatalogPipeline?: (id: string) => { steps: Array<{
      label: string;
      archetype: ArchetypeId;
      view: ViewDescriptor;
      autoMode?: 'cli' | 'deterministic' | 'skip';
      accept?: (data: Record<string, unknown>) => { tier?: AcceptanceTier };
    }> } | null;
  };
  const pipeline = reg.getCatalogPipeline?.(catalogId);
  if (!pipeline) return [];
  return pipeline.steps.map((s) => {
    const res = s.accept ? s.accept({}) : { tier: 'L0' as const };
    return {
      label: s.label,
      archetype: s.archetype,
      tier: (res?.tier ?? 'L0') as AcceptanceTier,
      view: s.view,
      autoMode: s.autoMode,
    };
  });
}

export function createOrchestrator(opts: OrchestratorOptions = {}): Orchestrator {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const stepsFor = opts.stepsFor ?? defaultStepsFor;

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const env = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !env.success) throw new Error(env.error ?? `HTTP ${res.status} for ${url}`);
    return env.data as T;
  }

  return {
    async start(catalogId: string, userHint?: string) {
      const store = useOneShotJobStore.getState();
      if (!store.canStart()) throw new Error('another one-shot is in flight — cancel it first');
      store.reset();
      store.setPhase('analyzing', { catalogId, jobId: mkJobId(), userHint });
      const distribution = await postJson<unknown>('/api/one-shot/analyze', { catalogId, userHint });
      store.setPhase('proposing');
      const proposal = await postJson<{ name: string; data: unknown; rationale: string }>(
        '/api/one-shot/propose',
        { catalogId, distribution, userHint },
      );
      store.setProposal(proposal);
    },

    async refine(userInput: string, forceMore = false) {
      const store = useOneShotJobStore.getState();
      if (!['proposing', 'refining'].includes(store.phase)) {
        throw new Error('not in a refinable phase');
      }
      const ok = store.incRefinementTurn(forceMore);
      if (!ok) throw new Error('refinement turn cap reached — pass forceMore=true to continue');
      store.setPhase('refining');
      const proposal = await postJson<{ name: string; data: unknown; rationale: string }>(
        '/api/one-shot/refine',
        { catalogId: store.catalogId, prior: store.proposal, userInput },
      );
      store.setProposal(proposal);
      store.setPhase('proposing');
    },

    async approveAndRun() {
      const store = useOneShotJobStore.getState();
      if (!['proposing', 'awaitingRun'].includes(store.phase)) {
        throw new Error('no approvable proposal');
      }
      if (!store.proposal || !store.catalogId) throw new Error('no proposal');

      const draftId = `draft-${store.catalogId}-${Date.now()}`;
      useCatalogStore.getState().addDraft(store.catalogId, {
        id: draftId,
        catalogId: store.catalogId,
        name: store.proposal.name,
        categoryPath: [],
        tags: ['one-shot'],
        lifecycle: 'planned',
        data: store.proposal.data as unknown,
      });
      store.setPhase('running', { draftEntityId: draftId });

      const steps = stepsFor(store.catalogId);
      const jobId = store.jobId!;
      eventBus.emit('oneshot.started', {
        jobId,
        jobName: store.catalogId,
        totalSteps: steps.length,
        catalogId: store.catalogId,
        entityId: draftId,
      });

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const dec = decide(s.archetype, s.tier, s.view, { autoMode: s.autoMode });
        let outcome: 'pass' | 'fail' | 'skipped' | 'deferred' = 'pass';
        let reason: string | undefined;

        try {
          if (dec.mode === 'skip-needs-art') {
            outcome = 'skipped';
            reason = 'needs human selection';
          } else if (dec.mode === 'defer-runtime') {
            outcome = 'deferred';
            reason = `${dec.tier} pending the test-gate runner`;
          } else {
            const mode = dec.mode === 'run-cli' ? 'cli' : 'deterministic';
            const result = await postJson<{ outcome: 'pass' | 'fail'; reason?: string }>(
              '/api/one-shot/step',
              { catalogId: store.catalogId, entityId: draftId, stepLabel: s.label, mode },
            );
            outcome = result.outcome;
            reason = result.reason;
          }
        } catch (e) {
          outcome = 'fail';
          reason = e instanceof Error ? e.message : String(e);
        }

        useOneShotJobStore.getState().recordStep({ step: s.label, outcome, reason });
        eventBus.emit('oneshot.step-completed', {
          jobId,
          stepIndex: i,
          totalSteps: steps.length,
          stepName: s.label,
          outcome,
          reason,
        });
      }

      useOneShotJobStore.getState().markCompleted();
      const sum = useOneShotJobStore.getState().lastSummary!;
      eventBus.emit('oneshot.completed', {
        jobId,
        jobName: store.catalogId,
        totalSteps: steps.length,
        ...sum,
        catalogId: store.catalogId,
        entityId: draftId,
      });
    },

    cancel() {
      useOneShotJobStore.getState().setPhase('failed', { failureReason: 'cancelled' });
    },
  };
}
