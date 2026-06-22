import { getArtifact, listDeferredArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { classifyVerdictChange } from '@/lib/notify/verdict-change';
import { parseTestName } from './parse';
import { resolveScenario } from './scenarioRegistry';
import type { DrainResult, DrainSummary, GateExecutor, GateJob, GateTier } from './types';

export interface DrainFilter {
  tier?: GateTier;
  catalogId?: string;
  entityId?: string;
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
  return listDeferredArtifacts(filter).map((a) => {
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
  const existing = getArtifact(job.catalogId, job.entityId, job.step);
  const from = existing?.status ?? null;
  upsertArtifact({
    catalogId: job.catalogId,
    entityId: job.entityId,
    step: job.step,
    data: existing?.data ?? {},
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
    eventBus.emit('gate.verdict.changed', {
      catalogId: job.catalogId,
      entityId: job.entityId,
      step: job.step,
      tier: job.tier,
      from,
      to: verdict.status,
      regression: change.regression,
      detail: verdict.detail,
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
