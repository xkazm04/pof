// Server-only: persistence for the nightly-build schedule config + last-run
// state, backed by the `settings` table. Plus an in-memory single-flight guard
// so concurrent ticks (client poll + server cron) never start two cooks.

import { getSetting, setSetting } from '@/lib/db';
import { DEFAULT_SCHEDULE, type BuildSchedule } from './build-scheduler';

const CONFIG_KEY = 'build_schedule';
const STATE_KEY = 'build_schedule_state';

export type ScheduleOutcome = 'success' | 'failed' | 'skipped';

export interface ScheduleState {
  /** ISO timestamp of the last tick that actually ran or skipped. */
  lastRunAt: string | null;
  /** git HEAD at the last build (the skip-if-unchanged baseline). */
  lastCommit: string | null;
  lastOutcome: ScheduleOutcome | null;
  lastReason: string | null;
  lastBuildId: number | null;
  lastDurationMs: number | null;
}

const DEFAULT_STATE: ScheduleState = {
  lastRunAt: null,
  lastCommit: null,
  lastOutcome: null,
  lastReason: null,
  lastBuildId: null,
  lastDurationMs: null,
};

export function getSchedule(): BuildSchedule {
  const raw = getSetting(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_SCHEDULE };
  try {
    const parsed = JSON.parse(raw) as Partial<BuildSchedule>;
    return { ...DEFAULT_SCHEDULE, ...parsed };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function setSchedule(patch: Partial<BuildSchedule>): BuildSchedule {
  const next = { ...getSchedule(), ...patch };
  setSetting(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function getScheduleState(): ScheduleState {
  const raw = getSetting(STATE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<ScheduleState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function setScheduleState(patch: Partial<ScheduleState>): ScheduleState {
  const next = { ...getScheduleState(), ...patch };
  setSetting(STATE_KEY, JSON.stringify(next));
  return next;
}

// ── In-memory single-flight guard ────────────────────────────────────────────
// One cook at a time per server process. Not persisted: a process restart is a
// natural reset (a half-finished cook is already dead).

let running = false;

export function isRunning(): boolean {
  return running;
}

export function setRunning(value: boolean): void {
  running = value;
}
