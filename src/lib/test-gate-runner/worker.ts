import { logger } from '@/lib/logger';
import { collectDeferred, drainJobs, type DrainFilter } from './drain';
import { buildExecutors, type ExecutorConfig } from './executors';
import type { DrainSummary, GateJob } from './types';

/**
 * The optional always-on drain worker (the contract's serialized worker mode) —
 * a thin loop over the verified `drainJobs` primitive. Operator-toggled via
 * /api/pipeline-artifacts/drain/worker. Serialized (no overlapping ticks) and
 * skip-cooled so jobs that can't yet run (not_found / unavailable / no test name)
 * aren't re-attempted every tick.
 */

export interface WorkerConfig {
  intervalMs: number;
  /** Don't re-attempt a skipped job for this long (default 5 min). */
  cooldownMs?: number;
  filter?: DrainFilter;
  /** Executor build config; defaults to the bridge (L3 only — L4 needs a screenshot). */
  executor?: ExecutorConfig;
}

export interface WorkerStatus {
  running: boolean;
  intervalMs: number;
  ticks: number;
  lastTickAt: string | null;
  lastSummary: Pick<DrainSummary, 'ran' | 'passed' | 'failed' | 'skipped'> | null;
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let cfg: WorkerConfig | null = null;
const cooldownUntil = new Map<string, number>();
const status: WorkerStatus = { running: false, intervalMs: 0, ticks: 0, lastTickAt: null, lastSummary: null };

const keyOf = (j: GateJob) => `${j.catalogId}|${j.entityId}|${j.step}`;

/** One drain pass: collect deferred jobs not in cooldown, drain them, refresh cooldowns. Exported for tests. */
export async function runDrainTick(now: number = Date.now()): Promise<DrainSummary | null> {
  if (!cfg) return null;
  const executors = buildExecutors(cfg.executor ?? { executor: 'bridge' });
  const jobs = collectDeferred(cfg.filter).filter((j) => (cooldownUntil.get(keyOf(j)) ?? 0) <= now);
  const summary = jobs.length
    ? await drainJobs(jobs, executors)
    : { ran: 0, passed: 0, failed: 0, skipped: 0, results: [] };

  const cooldown = cfg.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  for (const r of summary.results) {
    if (r.skipped) cooldownUntil.set(keyOf(r.job), now + cooldown);
    else cooldownUntil.delete(keyOf(r.job));
  }
  status.ticks += 1;
  status.lastTickAt = new Date(now).toISOString();
  status.lastSummary = { ran: summary.ran, passed: summary.passed, failed: summary.failed, skipped: summary.skipped };
  return summary;
}

export function startDrainWorker(config: WorkerConfig): WorkerStatus {
  stopDrainWorker();
  cfg = config;
  cooldownUntil.clear();
  status.running = true;
  status.intervalMs = config.intervalMs;
  status.ticks = 0;
  status.lastTickAt = null;
  status.lastSummary = null;

  timer = setInterval(() => {
    if (tickInFlight) return; // never overlap ticks
    tickInFlight = true;
    runDrainTick()
      .catch((e) => logger.warn(`[drain-worker] tick failed: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => { tickInFlight = false; });
  }, config.intervalMs);
  // Don't keep the Node process alive solely for the worker (no-op in non-Node).
  (timer as unknown as { unref?: () => void }).unref?.();

  logger.info(`[drain-worker] started @ ${config.intervalMs}ms`);
  return { ...status };
}

export function stopDrainWorker(): WorkerStatus {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  status.running = false;
  logger.info('[drain-worker] stopped');
  return { ...status };
}

export function getWorkerStatus(): WorkerStatus {
  return { ...status };
}
