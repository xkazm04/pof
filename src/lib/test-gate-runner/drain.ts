import { getArtifact, listDeferredArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { classifyVerdictChange } from '@/lib/notify/verdict-change';
import { summarizeEvidence } from '@/types/observation';
import { parseTestName } from './parse';
import { resolveScenario } from './scenarioRegistry';
import type { DrainResult, DrainSummary, GateExecutor, GateJob, GateTier } from './types';

export interface DrainFilter {
  tier?: GateTier;
  catalogId?: string;
  entityId?: string;
  /**
   * Multi-entity batch (catalog-level drain): restrict to this set of entities within
   * `catalogId`. Takes precedence over `entityId`. ONE catalog-scoped DB collection is
   * filtered to the set in JS, so the whole batch shares ONE availability probe and ONE
   * grouped boot (via {@link drainJobs}). Additive — absent means single-entity/global.
   */
  entityIds?: string[];
}

/** Coerce an arbitrary tier string to a runnable gate tier (deferred jobs are L3/L4 only). */
export function parseTier(v: string | null | undefined): GateTier | undefined {
  return v === 'L3' || v === 'L4' ? v : undefined;
}

/**
 * Build a {@link DrainFilter} from a generic key getter, so the GET (searchParams),
 * POST (JSON body), and worker handlers all parse tier/catalogId/entityId identically —
 * a single place to extend when the filter grows a field.
 */
export function parseDrainFilter(
  get: (k: 'tier' | 'catalogId' | 'entityId') => string | null | undefined,
): DrainFilter {
  const tier = parseTier(get('tier'));
  const catalogId = get('catalogId');
  const entityId = get('entityId');
  return {
    ...(tier ? { tier } : {}),
    ...(catalogId ? { catalogId } : {}),
    ...(entityId ? { entityId } : {}),
  };
}

/** Turn the deferred `pipeline_artifacts` rows into runnable jobs. */
export function collectDeferred(filter?: DrainFilter): GateJob[] {
  // A multi-entity batch collects the catalog once (ONE DB pass) then filters to the set in
  // JS — the single-entity `entityId` is only pushed to the DB when no set is given.
  const entitySet = filter?.entityIds?.length ? new Set(filter.entityIds) : null;
  const listFilter: DrainFilter = {
    ...(filter?.tier ? { tier: filter.tier } : {}),
    ...(filter?.catalogId ? { catalogId: filter.catalogId } : {}),
    ...(!entitySet && filter?.entityId ? { entityId: filter.entityId } : {}),
  };
  return listDeferredArtifacts(listFilter)
    .filter((a) => !entitySet || entitySet.has(a.entityId))
    .map((a) => {
    const testName = parseTestName(a.reason) ?? undefined;
    const scenario = resolveScenario({ catalogId: a.catalogId, entityId: a.entityId, step: a.step, testName });
    return {
      catalogId: a.catalogId,
      entityId: a.entityId,
      step: a.step,
      tier: (a.tier === 'L4' ? 'L4' : 'L3') as GateTier,
      ...(testName ? { testName } : {}),
      ...(scenario ? { scenario } : {}),
      ...(a.reason ? { reason: a.reason } : {}),
    };
  });
}

/** Run one gate and write the verdict back, preserving the artifact's data/assets/tier. */
export async function drainOne(job: GateJob, executor: GateExecutor): Promise<DrainResult> {
  const verdict = await executor.run(job);
  // Read-merge-write, kept overlap-safe two ways: (1) the drain LEASE (held by both the route
  // AND the worker — see drain-lease.ts) serializes drain passes so two of them never touch the
  // same artifact at once; (2) this read→merge→write runs with NO `await` between `getArtifact`
  // and `upsertArtifact`, so on the single-threaded event loop it is atomic w.r.t. any other JS
  // task (incl. a concurrent Produce POST) — and because the read happens immediately before the
  // write, we always merge evidence onto the FRESHEST snapshot (a Produce landing during `run()`
  // above is picked up). No lost evidence, no torn write.
  const existing = getArtifact(job.catalogId, job.entityId, job.step);
  const from = existing?.status ?? null;
  // Merge the structured evidence into the artifact's data, PRESERVING everything already there
  // (genHistory, produced payloads, …). The bounded `GateEvidence` (capped samples, truncated
  // judge text — see @/types/observation) makes the flip auditable without re-running the gate.
  const prevData = existing?.data ?? {};
  const data = verdict.evidence ? { ...prevData, evidence: verdict.evidence } : prevData;
  upsertArtifact({
    catalogId: job.catalogId,
    entityId: job.entityId,
    step: job.step,
    data,
    ueAssets: existing?.ueAssets ?? [],
    status: verdict.status,
    tier: job.tier,
    reason: verdict.detail,
  });

  // Announce only real verdict moves (e.g. deferred→fail / pass→fail). Subscribers
  // — devtools, analytics, the opt-in webhook notifier — react; the drain doesn't
  // know or care who's listening.
  const change = classifyVerdictChange(from, verdict.status);
  if (change.changed) {
    const evidenceSummary = summarizeEvidence(verdict.evidence);
    eventBus.emit('gate.verdict.changed', {
      catalogId: job.catalogId,
      entityId: job.entityId,
      step: job.step,
      tier: job.tier,
      from,
      to: verdict.status,
      regression: change.regression,
      detail: verdict.detail,
      ...(evidenceSummary ? { evidence: evidenceSummary } : {}),
    }, 'test-gate-runner');
  }

  return { job, verdict };
}

/**
 * Drain a given set of jobs one at a time (the implicit single-resource lease).
 * Each job goes to the first tier-matched, available executor; jobs with no
 * executor, no available executor, or (for L3) no recovered test name are skipped
 * and stay deferred — never failed. `opts.limit` caps the number actually run.
 */
export async function drainJobs(
  jobs: GateJob[],
  executors: GateExecutor[],
  opts?: { limit?: number },
): Promise<DrainSummary> {
  const results: DrainResult[] = [];
  let runCount = 0;

  // Availability is a per-pass property of an executor (e.g. the bridge's reachability
  // is one HTTP /status GET, not consumed by running a job), so probe each distinct
  // executor at most once per drain pass and reuse the result across its jobs — instead
  // of one round-trip to the non-reentrant UE bridge per job. Lazily memoized so an
  // executor is only probed when a tier-matched job actually reaches it (preserves the
  // prior behaviour where an executor with no matching jobs is never probed).
  const availability = new Map<GateExecutor, boolean>();
  const isAvailable = async (e: GateExecutor): Promise<boolean> => {
    const cached = availability.get(e);
    if (cached !== undefined) return cached;
    const ok = await e.available();
    availability.set(e, ok);
    return ok;
  };

  // One boot, many gates: the first time an AVAILABLE batch-capable executor is reached, let
  // it pre-run all its tier-matched jobs in ONE shot (the spawn executor boots ONE headless
  // editor for every automation gate) and cache the per-job verdicts `run` then returns. Runs
  // at most once per executor per pass (mirrors the availability memo) and only after the
  // executor proved available — so an unavailable/unmatched executor never boots.
  //
  // `prepared` is marked ONLY after `prepareBatch` SUCCEEDS — marking it before the await meant
  // a failed grouped boot silently degraded every LATER job to a per-job single boot AND wrongly
  // parked the triggering job with no batch retry. Now: one retry, then HONEST degradation
  // (logged loudly) to per-job boots — and `ensurePrepared` never throws, so the triggering job
  // still runs its own per-job boot via `drainOne` instead of being parked.
  const preparedOk = new Set<GateExecutor>(); // batch pre-ran → `run` serves the cache
  const degraded = new Set<GateExecutor>();   // batch failed twice → fall back to per-job boots
  const ensurePrepared = async (e: GateExecutor): Promise<void> => {
    if (preparedOk.has(e) || degraded.has(e)) return;
    if (!e.prepareBatch) { preparedOk.add(e); return; }
    const batchJobs = jobs.filter((j) => j.tier === e.tier);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await e.prepareBatch(batchJobs);
        preparedOk.add(e);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'prepareBatch error';
        if (attempt < 2) {
          logger.warn(`[test-gate-runner] ${e.id} grouped boot failed (attempt ${attempt}/2), retrying: ${msg}`);
        } else {
          logger.warn(`[test-gate-runner] ${e.id} grouped boot failed twice — DEGRADING to per-job boots: ${msg}`);
          degraded.add(e);
        }
      }
    }
  };

  for (const job of jobs) {
    if (opts?.limit != null && runCount >= opts.limit) {
      results.push({ job, skipped: 'limit reached' });
      continue;
    }
    const executor = executors.find((e) => e.tier === job.tier);
    if (!executor) {
      results.push({ job, skipped: `no ${job.tier} executor` });
      continue;
    }
    if (job.tier === 'L3' && !job.testName && !job.scenario) {
      results.push({ job, skipped: 'no test name or scenario for L3 gate' });
      continue;
    }
    if (!(await isAvailable(executor))) {
      results.push({ job, skipped: `${executor.id} unavailable` });
      continue;
    }
    try {
      await ensurePrepared(executor); // ONE grouped boot for this executor's batchable jobs
      runCount++;
      results.push(await drainOne(job, executor));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'executor error';
      logger.warn(`[test-gate-runner] ${job.catalogId}/${job.entityId}/${job.step}: ${msg}`);
      results.push({ job, skipped: msg });
    }
  }

  return {
    ran: results.filter((r) => r.verdict).length,
    passed: results.filter((r) => r.verdict?.status === 'pass').length,
    failed: results.filter((r) => r.verdict?.status === 'fail').length,
    // Ran but produced no pass/fail (judge outage or test-not-registered) — unified across
    // both L3 executors and the L4 visual executor into one honest bucket.
    deferred: results.filter((r) => r.verdict?.status === 'deferred').length,
    skipped: results.filter((r) => r.skipped).length,
    // Hoist L4 frames to the top level so callers (the drain route, pof_drain_gates) can hand
    // them straight to the agent to READ — closing the "agent must look" loop.
    screenshots: results
      .map((r) => r.verdict?.screenshot)
      .filter((s): s is string => typeof s === 'string' && s.length > 0),
    results,
  };
}

/** Collect all matching deferred gates, then drain them. The one-shot entry point. */
export async function drainAll(
  executors: GateExecutor[],
  filter?: DrainFilter,
  opts?: { limit?: number },
): Promise<DrainSummary> {
  return drainJobs(collectDeferred(filter), executors, opts);
}
