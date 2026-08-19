// Server-only: persistence for the nightly-build schedule config + last-run
// state, backed by the `settings` table. Plus an in-memory single-flight guard
// so concurrent ticks (client poll + server cron) never start two cooks.

import {
  expectRecord, readSettingsBlob, updateSettingsBlob,
  type SettingsBlobRead, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';
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

/**
 * The whole nightly-build schedule is one JSON string in one `settings` row. An
 * unparseable value used to read as `DEFAULT_SCHEDULE` — nightly builds quietly
 * stop, and the next `setSchedule` patch serialises those defaults over the
 * user's real cron. The corrupt default stays disabled (never cook off a
 * schedule nobody could read), but it is logged, flagged, and cannot be written
 * back over the original bytes.
 */
const SCHEDULE_SPEC: SettingsBlobSpec<BuildSchedule> = {
  key: CONFIG_KEY,
  absent: () => ({ ...DEFAULT_SCHEDULE }),
  // Fail-closed: an unreadable schedule must not trigger automated builds.
  corrupt: () => ({ ...DEFAULT_SCHEDULE, enabled: false }),
  hydrate: (parsed) => ({ ...DEFAULT_SCHEDULE, ...(expectRecord(parsed, 'build schedule') as Partial<BuildSchedule>) }),
};

/**
 * Runtime state, not configuration: written by the background cook when it
 * finishes. `lastCommit: null` on the corrupt path is the fail-closed answer —
 * an unknown baseline forces a build rather than skipping one as "unchanged".
 */
const STATE_SPEC: SettingsBlobSpec<ScheduleState> = {
  key: STATE_KEY,
  absent: () => ({ ...DEFAULT_STATE }),
  corrupt: () => ({ ...DEFAULT_STATE }),
  hydrate: (parsed) => ({ ...DEFAULT_STATE, ...(expectRecord(parsed, 'build schedule state') as Partial<ScheduleState>) }),
};

/** The full read, for a caller that wants to REPORT an unreadable schedule. */
export function readScheduleBlob(): SettingsBlobRead<BuildSchedule> {
  return readSettingsBlob(SCHEDULE_SPEC);
}

export function getSchedule(): BuildSchedule {
  return readSettingsBlob(SCHEDULE_SPEC).value;
}

/** Throws `SettingsBlobCorruptError` rather than overwriting an unreadable schedule. */
export function setSchedule(patch: Partial<BuildSchedule>): BuildSchedule {
  return updateSettingsBlob(SCHEDULE_SPEC, (current) => ({ ...current, ...patch })).value;
}

export function getScheduleState(): ScheduleState {
  return readSettingsBlob(STATE_SPEC).value;
}

/**
 * A finished cook must always be able to record what happened, so an unreadable
 * state is preserved under a quarantine key and the write proceeds — this is
 * runtime state, not user configuration, and the new value does not derive from
 * the unreadable one in any way the operator would miss.
 */
export function setScheduleState(patch: Partial<ScheduleState>): ScheduleState {
  return updateSettingsBlob(STATE_SPEC, (current) => ({ ...current, ...patch }), {
    onCorrupt: 'preserve-and-continue',
  }).value;
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
