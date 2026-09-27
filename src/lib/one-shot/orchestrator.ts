'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { eventBus } from '@/lib/event-bus';
import { logger } from '@/lib/logger';
import { decide } from './skip-policy';
import type { ArchetypeId, ViewDescriptor, AcceptanceTier } from './types';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';
import type { GapTarget } from '@/lib/catalog/gap-analysis/rankGaps';
import { createPostJson, createProposalPhases } from './proposalPhases';
import { stepsForProfile } from '@/lib/catalog/stepScope';

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
  /** Gap-first step 1: measure the catalog; stops at phase `analyzed` (no LLM run). */
  analyze(catalogId: string, userHint?: string): Promise<CatalogDistribution>;
  /** Gap-first step 2: propose aimed at the picked gap (null = let the model pick). */
  proposeFor(target: GapTarget | null, userHint?: string): Promise<void>;
  /** analyze + proposeFor(null) — the composed one-click path. */
  start(catalogId: string, userHint?: string): Promise<void>;
  refine(userInput: string, forceMore?: boolean): Promise<void>;
  approveAndRun(): Promise<void>;
  cancel(): void;
}

function defaultStepsFor(catalogId: string): OrchestratorStepRef[] {
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) return [];
  // One-shot drafts are the project's own entities: steps scoped to other canon profiles are not theirs (D18).
  return stepsForProfile(pipeline).map((s) => {
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
  // Resolve the global lazily: a module-level orchestrator must see a fetch installed later.
  const fetchImpl: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const stepsFor = opts.stepsFor ?? defaultStepsFor;
  let _cancelled = false;

  const postJson = createPostJson(fetchImpl);
  const phases = createProposalPhases(postJson);

  return {
    async analyze(catalogId: string, userHint?: string) {
      _cancelled = false;
      return phases.analyze(catalogId, userHint);
    },

    proposeFor: phases.proposeFor,

    async start(catalogId: string, userHint?: string) {
      _cancelled = false;
      await phases.analyze(catalogId, userHint);
      await phases.proposeFor(null);
    },

    refine: phases.refine,

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

      // Make the entity RESOLVABLE BY THE SERVER before a single artifact is written for it.
      // Until this route existed, the draft lived only in `localStorage` while its ~11
      // pipeline artifacts went to SQLite: `seededEntities` missed it, so `listEntitySummaries`
      // omitted it, the server `CheckerContext.has()` said false and the static-verify resolver
      // returned `null` — the entity silently exempted itself from every gate. The browser
      // store is now the cache; `catalog_entities` is the record.
      //
      // A failed persist is NOT swallowed: the draft is flagged `browserOnly` with the reason,
      // which the catalog tree renders as "gates cannot run". The run still proceeds, because
      // stopping it would destroy work the user already approved — but nothing pretends the
      // entity is durable.
      try {
        await postJson('/api/catalog-entities', {
          catalogId: store.catalogId,
          entityId: draftId,
          name: store.proposal.name,
          source: 'one-shot',
          tags: ['one-shot'],
          data: store.proposal.data,
        });
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        logger.warn(`one-shot: could not persist ${store.catalogId}/${draftId} server-side — ${reason}`);
        useCatalogStore.getState().markDraftBrowserOnly(store.catalogId, draftId, reason);
      }

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
            // `deferred` is a legal terminal state for an L3/L4 gate (Rule 5), and the
            // route used to collapse it into `fail` before it ever reached this log —
            // reporting a correct deferral to the operator as a failure. `status` carries
            // the exact 4-state checker verdict alongside the run-log outcome.
            const result = await postJson<{
              outcome: 'pass' | 'fail' | 'deferred';
              status?: string;
              tier?: string;
              reason?: string;
            }>(
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
            // A deferral must always carry a reason (Rule 4); if the checker gave none,
            // say at least which tier deferred it rather than logging a bare "deferred".
            reason = result.reason
              ?? (result.outcome === 'deferred' ? `${result.tier ?? s.tier} deferred by the step's checker` : undefined);
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
