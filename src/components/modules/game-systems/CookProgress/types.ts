import type { CookPhase } from '@/lib/packaging/cook-executor';

/**
 * How a cook SETTLED — delivered once, after the server recorded (or failed to record)
 * the build row, never on the bare `done`/`error` event.
 */
export interface CookCompletion {
  status: 'success' | 'failed';
  exePath?: string;
  error?: string;
  /** The build_history row the server recorded for this cook (the `recorded` event). */
  buildId?: number;
  /** Why no row was recorded: a `record-error` event, or a stream that ended first. */
  recordError?: string;
}

/** The two events the execute route emits AFTER the terminal one (not in `CookEvent`). */
export type CookRecordEvent =
  | { type: 'recorded'; buildId: number; version?: string | null }
  | { type: 'record-error'; message: string; note?: string };

export interface CookProgressProps {
  request: { profileId: string; projectPath: string; projectName: string; ueVersion: string } | null;
  onComplete?: (result: CookCompletion) => void;
}

export type CookLogSeverity = 'error' | 'warning' | 'info';

/** A parsed cook log line: raw text + the elapsed timestamp, phase, and severity. */
export interface CookLogLine {
  /** Monotonic id (stable virtualization key). */
  id: number;
  /** Raw UAT line. */
  line: string;
  /** Elapsed ms since cook start (from the `log` event's `t`). */
  t: number;
  /** Cook phase active when the line arrived — drives the Cook/Stage filters. */
  phase: CookPhase | null;
  /** Classified severity — drives the colored left border + Errors/Warnings filters. */
  severity: CookLogSeverity;
}

/** The log filter facets shown above the console. */
export type CookLogFilter = 'all' | 'error' | 'warning' | 'cook' | 'stage';

/** Per-facet tallies for the filter chips — the shape of the `counts` state. */
export type CookLogCounts = Record<CookLogFilter, number>;

export interface CookLogRowData {
  lines: CookLogLine[];
}
