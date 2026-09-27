'use client';

import { useOneShotJobStore, type OneShotPhase, type StepResult } from '@/stores/oneShotJobStore';
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
  /** Interrupted run (`failed` with a draft): run only the unrecorded steps on the SAME draft. */
  resume(): Promise<void>;
  /** Re-run only the steps whose recorded outcome is `fail`, replacing each in place. */
  retryFailed(): Promise<void>;
  /** In-flight analyze/propose/refine → its resting phase; a running pipeline → `failed`. */
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

  /** Run one step on the draft through the skip policy → its recorded result. */
  async function runStep(catalogId: string, entityId: string, s: OrchestratorStepRef): Promise<StepResult> {
    const dec = decide(s.archetype, s.tier, s.view, { autoMode: s.autoMode });
    if (dec.mode === 'skip-needs-art') return { step: s.label, outcome: 'skipped', reason: 'needs human selection' };
    if (dec.mode === 'defer-runtime') return { step: s.label, outcome: 'deferred', reason: `${dec.tier} pending the test-gate runner` };
    try {
      // Re-read proposal from store after each await to avoid stale closure snapshot.
      const currentProposal = useOneShotJobStore.getState().proposal;
      // `deferred` is a legal terminal state for an L3/L4 gate (Rule 5), and the route used to
      // collapse it into `fail` before it ever reached this log — reporting a correct deferral
      // to the operator as a failure. `status` carries the exact 4-state checker verdict.
      const result = await postJson<{ outcome: 'pass' | 'fail' | 'deferred'; status?: string; tier?: string; reason?: string }>(
        '/api/one-shot/step',
        {
          catalogId,
          entityId,
          stepLabel: s.label,
          mode: dec.mode === 'run-cli' ? 'cli' : 'deterministic',
          proposal: currentProposal ? { name: currentProposal.name, data: currentProposal.data } : undefined,
        },
      );
      // A deferral must always carry a reason (Rule 4); if the checker gave none,
      // say at least which tier deferred it rather than logging a bare "deferred".
      const reason = result.reason
        ?? (result.outcome === 'deferred' ? `${result.tier ?? s.tier} deferred by the step's checker` : undefined);
      return { step: s.label, outcome: result.outcome, reason };
    } catch (e) {
      return { step: s.label, outcome: 'fail', reason: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * The one run loop behind approveAndRun / resume / retryFailed: runs the steps `include`
   * admits (all when null) in pipeline order, recording (append) or replacing (in place) each
   * outcome. An `entry` of `failed` stays `failed` (with `priorReason`) while any step is
   * still unrecorded, so a partial retry never passes an interrupted run off as complete.
   */
  async function runPlan(
    catalogId: string, draftId: string, include: ((label: string) => boolean) | null,
    write: 'record' | 'replace', entry: OneShotPhase, priorReason?: string,
  ): Promise<void> {
    const steps = stepsFor(catalogId);
    useOneShotJobStore.getState().setTotalSteps(steps.length);
    const jobId = useOneShotJobStore.getState().jobId ?? `job-${draftId}`;
    eventBus.emit('oneshot.started', { jobId, jobName: catalogId, totalSteps: steps.length, catalogId, entityId: draftId });

    for (let i = 0; i < steps.length; i++) {
      if (_cancelled) break;
      if (include && !include(steps[i].label)) continue;
      const r = await runStep(catalogId, draftId, steps[i]);
      const st = useOneShotJobStore.getState();
      if (write === 'replace') st.upsertStep(r); else st.recordStep(r);
      eventBus.emit('oneshot.step-completed', {
        jobId, stepIndex: i, totalSteps: steps.length, stepName: r.step, outcome: r.outcome, reason: r.reason,
      });
    }

    if (_cancelled) return;
    const recorded = new Set(useOneShotJobStore.getState().stepResults.map((r) => r.step));
    if (entry === 'failed' && !steps.every((s) => recorded.has(s.label))) {
      useOneShotJobStore.getState().setPhase('failed', { failureReason: priorReason ?? 'incomplete' });
      return;
    }
    useOneShotJobStore.getState().markCompleted();
    const sum = useOneShotJobStore.getState().lastSummary!;
    if (sum.failed > 0 && sum.passed === 0) {
      eventBus.emit('oneshot.failed', { jobId, jobName: catalogId, stepIndex: steps.length - 1, totalSteps: steps.length, error: 'all steps failed' });
    } else {
      eventBus.emit('oneshot.completed', { jobId, jobName: catalogId, totalSteps: steps.length, ...sum, catalogId, entityId: draftId });
    }
  }

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
      await runPlan(store.catalogId, draftId, null, 'record', 'completed');
    },

    async resume() {
      const s = useOneShotJobStore.getState();
      if (s.phase !== 'failed' || !s.catalogId || !s.draftEntityId) throw new Error('nothing to resume — no interrupted run with a draft');
      const done = new Set(s.stepResults.map((r) => r.step));
      _cancelled = false;
      s.setPhase('running', { failureReason: undefined });
      await runPlan(s.catalogId, s.draftEntityId, (l) => !done.has(l), 'record', 'failed');
    },

    async retryFailed() {
      const s = useOneShotJobStore.getState();
      const failed = new Set(s.stepResults.filter((r) => r.outcome === 'fail').map((r) => r.step));
      if (!['completed', 'failed'].includes(s.phase) || !s.catalogId || !s.draftEntityId || failed.size === 0) {
        throw new Error('no failed steps to retry');
      }
      const entry = s.phase;
      const priorReason = s.failureReason;
      _cancelled = false;
      s.setPhase('running', { failureReason: undefined });
      await runPlan(s.catalogId, s.draftEntityId, (l) => failed.has(l), 'replace', entry, priorReason);
    },

    cancel() {
      if (phases.cancel()) return;
      const cancelStore = useOneShotJobStore.getState();
      if (cancelStore.phase !== 'running') return;
      _cancelled = true;
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
