import { ACCENT_RED, STATUS_NEUTRAL, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import type { HarnessRunSummary } from '@/lib/harness-runs-db';

export interface RunsResponse { runs: HarnessRunSummary[] }

export const STATUS_TONE: Record<HarnessRunSummary['status'], string> = {
  running: STATUS_WARNING,
  paused: STATUS_NEUTRAL,
  completed: STATUS_SUCCESS,
  error: ACCENT_RED,
  // A run stranded 'running' by a crash/restart, healed to a terminal state by
  // the lazy reaper — attention, but not a hard in-loop error.
  interrupted: STATUS_WARNING,
};
