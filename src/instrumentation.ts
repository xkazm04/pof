// Next.js server instrumentation. Registers the nightly-build cron: a 1-minute
// interval that asks the scheduler whether a build is due and starts it if so.
//
// The schedule is disabled by default, so this tick is a cheap settings read
// until the operator opts in. Runs only in the Node runtime (better-sqlite3 is
// node-only) and is guarded against double-registration on dev HMR.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as typeof globalThis & { __pofSchedulerStarted?: boolean };
  if (g.__pofSchedulerStarted) return;
  g.__pofSchedulerStarted = true;

  const [{ tickScheduler }, { UI_TIMEOUTS }, { logger }] = await Promise.all([
    import('@/lib/packaging/scheduled-build-runner'),
    import('@/lib/constants'),
    import('@/lib/logger'),
  ]);

  const timer = setInterval(() => {
    try {
      const result = tickScheduler();
      if (result.ran) logger.info(`[nightly-build] cron started a build: ${result.reason}`);
    } catch (err) {
      logger.warn(`[nightly-build] cron tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, UI_TIMEOUTS.scheduleTick);

  // The scheduler should never be the reason the process stays alive.
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('[nightly-build] scheduler cron registered');
}
