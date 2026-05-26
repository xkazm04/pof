import { getArtifact, listDeferredArtifacts, upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { logger } from '@/lib/logger';
import { parseTestName } from './parse';
import type { DrainResult, DrainSummary, GateExecutor, GateJob, GateTier } from './types';

export interface DrainFilter {
  tier?: GateTier;
  catalogId?: string;
  entityId?: string;
}

/** Turn the deferred `pipeline_artifacts` rows into runnable jobs. */
export function collectDeferred(filter?: DrainFilter): GateJob[] {
  return listDeferredArtifacts(filter).map((a) => ({
    catalogId: a.catalogId,
    entityId: a.entityId,
    step: a.step,
    tier: a.tier === 'L4' ? 'L4' : 'L3',
    ...(parseTestName(a.reason) ? { testName: parseTestName(a.reason)! } : {}),
    ...(a.reason ? { reason: a.reason } : {}),
  }));
}

/** Run one gate and write the verdict back, preserving the artifact's data/assets/tier. */
export async function drainOne(job: GateJob, executor: GateExecutor): Promise<DrainResult> {
  const verdict = await executor.run(job);
  const existing = getArtifact(job.catalogId, job.entityId, job.step);
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
  return { job, verdict };
}

/**
 * Drain deferred gates one at a time (the implicit single-resource lease). Each
 * job goes to the first tier-matched, available executor; jobs with no executor,
 * no available executor, or (for L3) no recovered test name are skipped and stay
 * deferred — never failed. `opts.limit` caps the number actually run.
 */
export async function drainAll(
  executors: GateExecutor[],
  filter?: DrainFilter,
  opts?: { limit?: number },
): Promise<DrainSummary> {
  const jobs = collectDeferred(filter);
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
    if (job.tier === 'L3' && !job.testName) {
      results.push({ job, skipped: 'no test name in deferred reason' });
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
