'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';
import { decide } from './skip-policy';
import type { ArchetypeId, ViewDescriptor, AcceptanceTier } from './types';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

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
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) return [];
  return pipeline.steps.map((s) => {
    const res = s.accept ? s.accept({}) : { tier: 'L0' as const };
    return {
      label: s.label,
      archetype: s.archetype,
      tier: (res?.tier ?? 'L0') as AcceptanceTier,
      view: s.view,
    };
  });
}

export function createOrchestrator(opts: OrchestratorOptions = {}): Orchestrator {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const stepsFor = opts.stepsFor ?? defaultStepsFor;
  let _cancelled = false;

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
      _cancelled = false;
      store.reset();
      store.setPhase('analyzing', { catalogId, jobId: mkJobId(), userHint });
      const distribution = await postJson<import('@/lib/catalog/gap-analysis').CatalogDistribution>('/api/one-shot/analyze', { catalogId, userHint });
      useOneShotJobStore.getState().setDistribution(distribution);
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
      _cancelled = false;
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
      useOneShotJobStore.getState().setTotalSteps(steps.length);
      const jobId = store.jobId!;
      eventBus.emit('oneshot.started', {
        jobId,
        jobName: store.catalogId,
        totalSteps: steps.length,
        catalogId: store.catalogId,
        entityId: draftId,
      });

      for (let i = 0; i < steps.length; i++) {
        if (_cancelled) break;
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
            // Re-read proposal from store after each await to avoid stale closure snapshot.
            const currentProposal = useOneShotJobStore.getState().proposal;
            const result = await postJson<{ outcome: 'pass' | 'fail'; reason?: string }>(
              '/api/one-shot/step',
              {
                catalogId: store.catalogId,
                entityId: draftId,
                stepLabel: s.label,
                mode,
                proposal: currentProposal
                  ? { name: currentProposal.name, data: currentProposal.data }
                  : undefined,
              },
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

      if (_cancelled) return;
      useOneShotJobStore.getState().markCompleted();
      const sum = useOneShotJobStore.getState().lastSummary!;
      if (sum.failed > 0 && sum.passed === 0) {
        eventBus.emit('oneshot.failed', {
          jobId,
          jobName: store.catalogId ?? '',
          stepIndex: steps.length - 1,
          totalSteps: steps.length,
          error: 'all steps failed',
        });
      } else {
        eventBus.emit('oneshot.completed', {
          jobId,
          jobName: store.catalogId,
          totalSteps: steps.length,
          ...sum,
          catalogId: store.catalogId,
          entityId: draftId,
        });
      }
    },

    cancel() {
      _cancelled = true;
      const cancelStore = useOneShotJobStore.getState();
      cancelStore.setPhase('failed', { failureReason: 'cancelled' });
      const cancelStepIndex = cancelStore.stepResults.length > 0 ? cancelStore.stepResults.length - 1 : 0;
      const cancelTotalSteps = cancelStore.totalSteps ?? 0;
      eventBus.emit('oneshot.failed', {
        jobId: cancelStore.jobId ?? '',
        jobName: cancelStore.catalogId ?? '',
        stepIndex: cancelStepIndex,
        totalSteps: cancelTotalSteps,
        error: 'cancelled',
      });
    },
  };
}
