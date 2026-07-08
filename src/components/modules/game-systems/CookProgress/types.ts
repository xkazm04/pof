import type { CookPhase } from '@/lib/packaging/cook-executor';

export interface CookProgressProps {
  request: { profileId: string; projectPath: string; projectName: string; ueVersion: string } | null;
  onComplete?: (result: { status: 'success' | 'failed'; exePath?: string; error?: string }) => void;
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
