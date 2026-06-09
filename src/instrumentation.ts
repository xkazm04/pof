// Next.js server instrumentation. Registers two server-startup hooks:
//   1. the nightly-build cron — a 1-minute interval that asks the scheduler
//      whether a build is due and starts it if so, and (self-throttled to once
//      per TTL window) purges expired request_log idempotency entries so that
//      table stays bounded;
//   2. the gate-notification webhook listener — subscribes to the typed
//      `gate.verdict.changed` channel so the drain can ping Slack/Discord/etc.
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
}
