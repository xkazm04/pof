// Client-safe scheduling + skip-if-unchanged logic for nightly builds.
//
// Pure functions only (no I/O): when should a scheduled build fire, when is the
// next fire, and should an unchanged tree be skipped. The server-side runner
// (scheduled-build-runner.ts) and the API route feed real git/time values in.

export interface BuildSchedule {
  /** Master on/off switch. Disabled by default — opt-in only. */
  enabled: boolean;
  /** Local time-of-day to fire, `HH:MM` (24h). */
  time: string;
  /** Allowed weekdays (0=Sun..6=Sat). Empty = every day (true "nightly"). */
  days: number[];
  /** Build profile to run. Null = fall back to the platform default profile. */
  profileId: string | null;
  /** Skip the cook when git HEAD is unchanged since the last scheduled build. */
  skipIfUnchanged: boolean;
  /** Build target captured at save time so the server cron can run unattended. */
  projectPath: string;
  projectName: string;
  ueVersion: string;
}

export const DEFAULT_SCHEDULE: BuildSchedule = {
  enabled: false,
  time: '02:00',
  days: [],
  profileId: null,
  skipIfUnchanged: true,
  projectPath: '',
  projectName: '',
  ueVersion: '',
};

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface TimeOfDay {
  hours: number;
  minutes: number;
}

/** Parse a strict `HH:MM` (zero-padded, 24h). Returns null when malformed. */
export function parseTimeOfDay(time: string): TimeOfDay | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return null;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

/** Today's scheduled slot as a local Date, or null when the time is invalid. */
function slotForDay(time: string, day: Date): Date | null {
  const tod = parseTimeOfDay(time);
  if (!tod) return null;
  const slot = new Date(day);
  slot.setHours(tod.hours, tod.minutes, 0, 0);
  return slot;
}

/**
 * Is a scheduled build due right now? True when the schedule is enabled, today
 * is an allowed weekday, `now` is at/after today's slot, and it has not already
 * run since that slot opened (same-day catch-up; missed full days are dropped).
 */
export function isDueAt(schedule: BuildSchedule, lastRunAt: string | null, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (schedule.days.length > 0 && !schedule.days.includes(now.getDay())) return false;

  const slot = slotForDay(schedule.time, now);
  if (!slot) return false;
  if (now.getTime() < slot.getTime()) return false;

  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  return last < slot.getTime();
}

/** The next datetime the schedule will fire, or null when disabled/invalid. */
export function nextRunAt(schedule: BuildSchedule, now: Date): Date | null {
  if (!schedule.enabled) return null;
  if (!parseTimeOfDay(schedule.time)) return null;

  for (let i = 0; i <= 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const slot = slotForDay(schedule.time, day);
    if (!slot) return null;
    const allowed = schedule.days.length === 0 || schedule.days.includes(slot.getDay());
    if (allowed && slot.getTime() > now.getTime()) return slot;
  }
  return null;
}

export interface SkipDecision {
  skip: boolean;
  reason: string;
}

const short = (sha: string) => sha.slice(0, 8);

/**
 * Decide whether an unchanged tree should skip the cook. When the toggle is on
 * and the current HEAD equals the last built commit, skip. An unknown current
 * HEAD or no prior commit always builds (fail-safe toward building).
 */
export function shouldSkipUnchanged(
  currentHead: string | null,
  lastBuiltCommit: string | null,
  skipIfUnchanged: boolean,
): SkipDecision {
  if (!skipIfUnchanged) return { skip: false, reason: 'skip-if-unchanged disabled' };
  if (!currentHead) return { skip: false, reason: 'git HEAD unavailable — building anyway' };
  if (!lastBuiltCommit) return { skip: false, reason: 'no prior build commit recorded' };
  if (currentHead === lastBuiltCommit) {
    return { skip: true, reason: `HEAD unchanged at ${short(currentHead)} since last build` };
  }
  return { skip: false, reason: `HEAD changed (${short(lastBuiltCommit)} → ${short(currentHead)})` };
}

/** One-line human summary for the UI. */
export function describeSchedule(schedule: BuildSchedule): string {
  if (!schedule.enabled) return 'Scheduled builds off';
  if (schedule.days.length === 0 || schedule.days.length === 7) {
    return `Nightly at ${schedule.time}`;
  }
  const names = [...schedule.days].sort((a, b) => a - b).map((d) => DAY_ABBR[d] ?? '?').join(', ');
  return `${names} at ${schedule.time}`;
}
