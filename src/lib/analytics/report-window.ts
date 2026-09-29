/**
 * Reporting-window authority for the session ledger (Weekly Digest, Project Wrapped).
 *
 * Every "which day / week / month is this row" decision goes through here, in ONE declared
 * zone, so a period's edges and its bucket keys can never disagree. Rows stay stored as ISO
 * UTC instants (`completed_at`); only the cut is zone-aware.
 *
 * Policy:
 * - Keys are calendar dates in the reporting zone: day `YYYY-MM-DD`, month `YYYY-MM`,
 *   week = the key of its Monday (ISO weeks are Monday-first).
 * - Windows are half-open `[start, end)` instants (ISO UTC strings), cut at zone midnight,
 *   so a row at exactly `end` belongs to the next window and nothing is counted twice.
 * - Calendar arithmetic runs on keys, never on instants, so a DST day still counts as one day.
 * - Every function takes the zone explicitly; results that describe a period echo it.
 */

/**
 * The declared reporting zone. PoF is a single-operator desktop app whose server runs on the
 * operator's machine, so the process's resolved Intl zone IS the operator's calendar. This is
 * the only place that reads it; callers pass the result down (tests pass a fixed zone).
 */
export function reportZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface WeekWindow {
  /** Monday key of the week, in `zone`. */
  startKey: string;
  /** Next Monday key (exclusive end). */
  endKey: string;
  /** The 7 day keys, Monday first. */
  dayKeys: string[];
  /** Inclusive start instant (zone midnight of `startKey`), ISO UTC. */
  start: string;
  /** Exclusive end instant (zone midnight of `endKey`), ISO UTC. */
  end: string;
  zone: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in `zone`. */
function wallClock(ms: number, zone: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of formatterFor(zone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, mo: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

function toMs(at: string | Date): number {
  return typeof at === 'string' ? Date.parse(at) : at.getTime();
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Calendar day key (`YYYY-MM-DD`) of an instant in `zone`. */
export function dayKey(at: string | Date, zone: string): string {
  const c = wallClock(toMs(at), zone);
  return `${pad(c.y, 4)}-${pad(c.mo)}-${pad(c.d)}`;
}

/** Calendar month key (`YYYY-MM`) of an instant in `zone`. */
export function monthKey(at: string | Date, zone: string): string {
  return dayKey(at, zone).slice(0, 7);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Shift a day key by whole calendar days. */
export function addDaysToKey(key: string, days: number): string {
  return new Date(keyToUtcMs(key) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole calendar days from key `a` to key `b`; negative when `b < a`. */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / 86_400_000);
}

/** Monday key of the week containing day key `key`. */
export function mondayOfKey(key: string): string {
  const dow = new Date(keyToUtcMs(key)).getUTCDay(); // 0 = Sunday
  return addDaysToKey(key, dow === 0 ? -6 : 1 - dow);
}

/** Week key (its Monday's day key) of an instant in `zone`. */
export function weekKey(at: string | Date, zone: string): string {
  return mondayOfKey(dayKey(at, zone));
}

/** Offset (ms) of `zone` from UTC at instant `ms`. */
function offsetAt(ms: number, zone: string): number {
  const c = wallClock(ms, zone);
  return Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s) - Math.floor(ms / 1000) * 1000;
}

/** First instant (ISO UTC) of day `key` in `zone` — its local midnight, or the first
 *  existing instant when a DST jump skips midnight. */
export function zoneDayStart(key: string, zone: string): string {
  const wall = keyToUtcMs(key);
  const guess = wall - offsetAt(wall, zone);
  const refined = wall - offsetAt(guess, zone);
  const pick = dayKey(new Date(refined), zone) === key ? refined : guess;
  return new Date(pick).toISOString();
}

/** The zone-local Monday-first week containing `ref`, as a half-open window. */
export function weekWindow(ref: Date, zone: string): WeekWindow {
  const startKey = weekKey(ref, zone);
  const endKey = addDaysToKey(startKey, 7);
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(startKey, i));
  return {
    startKey,
    endKey,
    dayKeys,
    start: zoneDayStart(startKey, zone),
    end: zoneDayStart(endKey, zone),
    zone,
  };
}

/** The week immediately before `w`, in the same zone. */
export function previousWeek(w: WeekWindow): WeekWindow {
  return weekWindow(new Date(Date.parse(w.start) - 1), w.zone);
}
