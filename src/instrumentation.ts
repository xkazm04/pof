// Next.js server instrumentation. Registers three server-startup hooks:
//   1. the nightly-build cron — a 1-minute interval that asks the scheduler
//      whether a build is due and starts it if so, and (self-throttled to once
//      per TTL window) purges expired request_log idempotency entries so that
//      table stays bounded;
//   2. the gate-notification webhook listener — subscribes to the typed
//      `gate.verdict.changed` channel so the drain can ping Slack/Discord/etc.;
//   3. the OPT-IN always-on drain worker — OFF by default. It starts only when
//      POF_DRAIN_WORKER_AUTOSTART is explicitly truthy, because a timer that
//      drives (or boots) the Unreal editor must never be a silent default. Either
//      way the decision is logged with its reason, so an operator never has to
//      guess whether a background drainer is live; it can also be toggled at
//      runtime from /harness → Gate drain.
//
// The build half is opt-in (disabled by default) and the purge is a cheap
// throttled DELETE, so until the operator turns the build on the tick is a cheap
// settings read plus an occasional purge, and the listener is an early-out. Runs
// only in the Node runtime (better-sqlite3 is node-only) and is guarded against
// double-registration on dev HMR.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as typeof globalThis & { __pofSchedulerStarted?: boolean };
  if (g.__pofSchedulerStarted) return;
  g.__pofSchedulerStarted = true;

  const [{ tickScheduler }, { UI_TIMEOUTS }, { logger }, { registerGateNotifier }, { tickPurgeExpiredKeys }] = await Promise.all([
    import('@/lib/packaging/scheduled-build-runner'),
    import('@/lib/constants'),
    import('@/lib/logger'),
    import('@/lib/notify/gate-notifier'),
    import('@/lib/request-log'),
  ]);

  // Wire the gate-verdict webhook listener onto the in-process event bus.
  registerGateNotifier();

  const timer = setInterval(() => {
    try {
      const result = tickScheduler();
      if (result.ran) logger.info(`[nightly-build] cron started a build: ${result.reason}`);
    } catch (err) {
      logger.warn(`[nightly-build] cron tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Keep the request_log idempotency table bounded — self-throttled to once
    // per TTL window, so this is a no-op on most ticks.
    try {
      const purged = tickPurgeExpiredKeys();
      if (purged > 0) logger.info(`[request-log] purged ${purged} expired idempotency ${purged === 1 ? 'entry' : 'entries'}`);
    } catch (err) {
      logger.warn(`[request-log] purge tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, UI_TIMEOUTS.scheduleTick);

  // The scheduler should never be the reason the process stays alive.
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('[nightly-build] scheduler cron registered');

  // ── Opt-in drain worker ───────────────────────────────────────────────────
  // Gate on the env var's PRESENCE before importing anything, so a default boot
  // never pulls the drain module graph (and its DB handles) in. Whether the value
  // is actually truthy is decided by the pure `resolveAutostartConfig`, which owns
  // the whole rule so this hook and the docs cannot drift apart.
  if (!process.env.POF_DRAIN_WORKER_AUTOSTART) {
    logger.info('[drain-worker] auto-start is OFF (the default) — set POF_DRAIN_WORKER_AUTOSTART=1, or start it from /harness → Gate drain');
    return;
  }
  try {
    const { resolveAutostartConfig, startDrainWorker } = await import('@/lib/test-gate-runner');
    const decision = resolveAutostartConfig(process.env);
    if (!decision.enabled) {
      logger.info(`[drain-worker] ${decision.reason}`);
      return;
    }
    logger.info(`[drain-worker] ${decision.notice}`);
    startDrainWorker(decision.config);
  } catch (err) {
    logger.warn(`[drain-worker] auto-start failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
