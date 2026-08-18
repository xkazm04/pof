import { logger } from '@/lib/logger';
import { collectDeferred, drainJobs, type DrainFilter } from './drain';
import { acquireLeases, releaseLeases, leaseKeysForFilter, scopeFromKey } from './drain-lease';
import { buildExecutors, type ExecutorConfig } from './executors';
import type { DrainSummary, GateJob } from './types';

/**
 * The optional always-on drain worker (the contract's serialized worker mode) —
 * a thin loop over the verified `drainJobs` primitive. Operator-toggled via
 * /api/pipeline-artifacts/drain/worker. Serialized (no overlapping ticks) and
 * skip-cooled so jobs that can't yet run (not_found / unavailable / no test name)
 * aren't re-attempted every tick.
 */

/** Who started the worker — reported in status so an auto-start is never mistaken for an operator action. */
export type WorkerOrigin = 'operator' | 'autostart';

export interface WorkerConfig {
  intervalMs: number;
  /** Don't re-attempt a skipped job for this long (default 5 min). */
  cooldownMs?: number;
  filter?: DrainFilter;
  /** Executor build config; defaults to the bridge (L3 only — L4 needs a screenshot). */
  executor?: ExecutorConfig;
  /** Provenance for the status read. Defaults to `operator`. */
  origin?: WorkerOrigin;
}

export interface WorkerStatus {
  running: boolean;
  intervalMs: number;
  ticks: number;
  lastTickAt: string | null;
  lastSummary: Pick<DrainSummary, 'ran' | 'passed' | 'failed' | 'deferred' | 'skipped'> | null;
  /** Who started the current (or most recent) worker; null before it has ever run. */
  origin: WorkerOrigin | null;
  /** The scope it drains — `{}` means every catalog/entity. Display only. */
  filter: DrainFilter;
  /** L3 mechanism in use: `bridge` talks to a RUNNING editor; `spawn` boots one (and is itself gated). */
  executor: 'bridge' | 'spawn';
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

/** Floor on the tick interval — mirrors the toggle route so both entry points agree. */
export const MIN_WORKER_INTERVAL_MS = 5_000;

/** Default tick interval for the opt-in auto-start (slower than the route's 30s manual default). */
export const AUTOSTART_DEFAULT_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let cfg: WorkerConfig | null = null;
const cooldownUntil = new Map<string, number>();
const status: WorkerStatus = {
  running: false, intervalMs: 0, ticks: 0, lastTickAt: null, lastSummary: null,
  origin: null, filter: {}, executor: 'bridge',
};

const keyOf = (j: GateJob) => `${j.catalogId}|${j.entityId}|${j.step}`;

/**
 * One drain pass: collect deferred jobs not in cooldown, drain them, refresh cooldowns.
 * Exported for tests.
 *
 * Acquires the SAME drain lease the POST route uses (keyed from `cfg.filter` — global by
 * default) so the always-on worker and a manual/route drain can never hit the non-reentrant
 * UE editor at once — the exact clobber the lease exists to prevent. If the lease is already
 * held the tick is SKIPPED gracefully (logged at debug, not an error) and returns `null`.
 */
export async function runDrainTick(now: number = Date.now()): Promise<DrainSummary | null> {
  if (!cfg) return null;

  // The lease covers the worker, not just the route. A held lease → skip this tick quietly.
  const leaseKeys = leaseKeysForFilter(cfg.filter ?? {});
  const acquired = acquireLeases(leaseKeys);
  if (!acquired.ok) {
    logger.debug(`[drain-worker] tick skipped — drain lease held by ${scopeFromKey(acquired.conflict)}`);
    return null;
  }
  try {
    // Sweep expired cooldowns up front: an entry whose cooldown has elapsed (value <= now)
    // is already non-gating (line below treats missing/expired identically), so dropping it
    // changes no behavior for live jobs while reclaiming keys for jobs that have vanished.
    for (const [k, until] of cooldownUntil) {
      if (until <= now) cooldownUntil.delete(k);
    }
    const executors = buildExecutors(cfg.executor ?? { executor: 'bridge' });
    const jobs = collectDeferred(cfg.filter).filter((j) => (cooldownUntil.get(keyOf(j)) ?? 0) <= now);
    const summary = jobs.length
      ? await drainJobs(jobs, executors)
      : { ran: 0, passed: 0, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [] };

    const cooldown = cfg.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    for (const r of summary.results) {
      if (r.skipped) cooldownUntil.set(keyOf(r.job), now + cooldown);
      else cooldownUntil.delete(keyOf(r.job));
    }
    status.ticks += 1;
    status.lastTickAt = new Date(now).toISOString();
    status.lastSummary = { ran: summary.ran, passed: summary.passed, failed: summary.failed, deferred: summary.deferred, skipped: summary.skipped };
    return summary;
  } finally {
    releaseLeases(leaseKeys);
  }
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
  status.origin = config.origin ?? 'operator';
  status.filter = config.filter ?? {};
  status.executor = config.executor?.executor === 'spawn' ? 'spawn' : 'bridge';

  timer = setInterval(() => {
    if (tickInFlight) return; // never overlap ticks
    tickInFlight = true;
    runDrainTick()
      .catch((e) => logger.warn(`[drain-worker] tick failed: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => { tickInFlight = false; });
  }, config.intervalMs);
  // Don't keep the Node process alive solely for the worker (no-op in non-Node).
  (timer as unknown as { unref?: () => void }).unref?.();

  logger.info(`[drain-worker] started by ${status.origin} @ ${config.intervalMs}ms (executor=${status.executor})`);
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

// ── Opt-in auto-start (instrumentation) ─────────────────────────────────────

/** The env keys that configure the boot-time auto-start. Named here so the docs + UI can't drift. */
export const AUTOSTART_ENV = {
  enable: 'POF_DRAIN_WORKER_AUTOSTART',
  intervalMs: 'POF_DRAIN_WORKER_INTERVAL_MS',
  cooldownMs: 'POF_DRAIN_WORKER_COOLDOWN_MS',
  executor: 'POF_DRAIN_WORKER_EXECUTOR',
  tier: 'POF_DRAIN_WORKER_TIER',
  catalogId: 'POF_DRAIN_WORKER_CATALOG',
} as const;

export type AutostartDecision =
  | { enabled: false; reason: string }
  | { enabled: true; config: WorkerConfig; notice: string };

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function positiveInt(raw: string | undefined, fallback: number, floor: number): number {
  const n = Number(raw);
  if (raw == null || raw.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.max(floor, Math.trunc(n));
}

/**
 * Decide whether the server should auto-start the drain worker at boot, purely from env.
 *
 * **The default is OFF.** A worker that boots Unreal (or drives a running editor) on a
 * timer is not a silent default, so it starts only when `POF_DRAIN_WORKER_AUTOSTART` is
 * explicitly truthy — and the decision (either way) is logged with its reason, so an
 * operator never has to guess whether a background drainer is live.
 *
 * Pure: reads the passed env bag and launches nothing. `src/instrumentation.ts` applies it.
 */
export function resolveAutostartConfig(env: NodeJS.ProcessEnv = process.env): AutostartDecision {
  const raw = env[AUTOSTART_ENV.enable];
  if (raw == null || raw.trim() === '') {
    return {
      enabled: false,
      reason: `auto-start is OFF (the default) — set ${AUTOSTART_ENV.enable}=1 to enable it, or start it from /harness → Gate drain`,
    };
  }
  if (!TRUTHY.has(raw.trim().toLowerCase())) {
    return { enabled: false, reason: `auto-start is OFF — ${AUTOSTART_ENV.enable}="${raw}" is not a truthy value` };
  }

  const intervalMs = positiveInt(env[AUTOSTART_ENV.intervalMs], AUTOSTART_DEFAULT_INTERVAL_MS, MIN_WORKER_INTERVAL_MS);
  const cooldownRaw = env[AUTOSTART_ENV.cooldownMs];
  const executor = env[AUTOSTART_ENV.executor]?.trim().toLowerCase() === 'spawn' ? 'spawn' : 'bridge';
  const tier = env[AUTOSTART_ENV.tier]?.trim();
  const catalogId = env[AUTOSTART_ENV.catalogId]?.trim();

  const filter: DrainFilter = {
    ...(tier === 'L3' || tier === 'L4' ? { tier } : {}),
    ...(catalogId ? { catalogId } : {}),
  };

  const config: WorkerConfig = {
    intervalMs,
    ...(cooldownRaw != null && cooldownRaw.trim() !== ''
      ? { cooldownMs: positiveInt(cooldownRaw, DEFAULT_COOLDOWN_MS, 0) }
      : {}),
    ...(Object.keys(filter).length ? { filter } : {}),
    // No appOrigin: an auto-started worker resolves L3 only. L4 needs a screenshot
    // source, which is an operator decision, not a boot-time one.
    executor: { executor },
    origin: 'autostart',
  };

  const scope = Object.keys(filter).length
    ? `${filter.tier ?? 'L3+L4'}${filter.catalogId ? ` · ${filter.catalogId}` : ''}`
    : 'every catalog, L3+L4';
  return {
    enabled: true,
    config,
    notice:
      `auto-start ENABLED via ${AUTOSTART_ENV.enable} — every ${intervalMs}ms, executor=${executor}, scope=${scope}. ` +
      'It acquires the SAME drain lease as an operator drain, so the two can never contend.',
  };
}
