/**
 * The ChatGPT plan's weekly meter, read from Codex's own session logs. Text tasks and image generation spend the same
 * meter and it does not say which used it, so the guard is on the TOTAL: at `TEXT_STOP_PERCENT` the dispatcher starts
 * no more text tasks, which keeps the rest of the week for images (owner, 2026-11-09, n10 call c-1).
 */
export const TEXT_STOP_PERCENT = 75;

/** The last `used_percent` of the primary window in one session's JSONL, or null when the log holds none. */
export function latestWeeklyPercent(jsonl: string): number | null {
  const lines = jsonl.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('rate_limits')) continue;
    try {
      const used = (JSON.parse(lines[i]) as { payload?: { rate_limits?: { primary?: { used_percent?: unknown } } } }).payload?.rate_limits?.primary?.used_percent;
      if (typeof used === 'number') return used;
    } catch { /* a partial line: keep looking */ }
  }
  return null;
}

/** Null means go. An unknown meter does not block: the guard protects a budget, it is not a gate on the work. */
export function meterRefusal(percent: number | null): string | null {
  return percent !== null && percent >= TEXT_STOP_PERCENT
    ? `weekly Codex meter is at ${percent} %: text tasks stop at ${TEXT_STOP_PERCENT} % so images keep the rest of the week`
    : null;
}
