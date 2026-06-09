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
    if (!(await executor.available())) {
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
