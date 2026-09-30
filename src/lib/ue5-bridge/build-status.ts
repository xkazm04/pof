/**
 * Build status: one read over the build's two homes.
 *
 * A headless build lives in the in-memory queue while it waits and runs, and in
 * its `headless_builds` row from enqueue to result (the row is written before
 * the spawn, see build-queue.ts). `resolveBuildStatus` answers GET
 * /api/ue5-bridge/build?buildId from both:
 *
 * - a live queue item wins (it has progress and is owned by this server);
 * - a terminal row answers with its summary, never the log;
 * - a 'running' row nobody owns is 'running (not owned)' until it is older than
 *   the build watchdog, then 'failed, interrupted';
 * - a 'queued' row nobody owns is 'failed, interrupted' at any age: the queue
 *   is in memory, so a queued build without a live item can never start.
 *
 * Pure: no DB, no clock. The caller passes the live item, the row and `now`.
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import type { BuildProgress, BuildQueueItem, BuildRequest, BuildStatus } from '@/types/ue5-bridge';

export const TERMINAL_BUILD_STATUSES: readonly BuildStatus[] = ['success', 'failed', 'aborted'];

export function isTerminalBuildStatus(status: string): boolean {
  return (TERMINAL_BUILD_STATUSES as readonly string[]).includes(status);
}

/** The summary columns of a `headless_builds` row: everything except the log and diagnostics. */
export interface BuildStatusRow {
  build_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  error_count: number;
  warning_count: number;
}

/** What GET ?buildId returns. Bounded: it never carries the build log. */
export interface BuildStatusView {
  buildId: string;
  status: BuildStatus;
  /** True when a live queue item in this server holds the build. Absent on a settled build. */
  owned?: boolean;
  request?: BuildRequest;
  queuedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  progress?: BuildProgress;
  errorCount?: number;
  warningCount?: number;
  durationMs?: number | null;
  exitCode?: number | null;
  /** The row says queued/running but nothing holds the build any more. */
  interrupted?: true;
  reason?: string;
}

export interface ResolveBuildStatusInput {
  live: BuildQueueItem | null;
  row: BuildStatusRow | null;
  now: number;
  /** How long an unowned 'running' row is still believed. Defaults to the build watchdog. */
  staleAfterMs?: number;
}

function interrupted(row: BuildStatusRow, reason: string): BuildStatusView {
  return {
    buildId: row.build_id, status: 'failed', startedAt: row.started_at, completedAt: null,
    errorCount: row.error_count, warningCount: row.warning_count, durationMs: null, exitCode: null,
    interrupted: true, reason,
  };
}

export function resolveBuildStatus(input: ResolveBuildStatusInput): BuildStatusView | null {
  const { live, row, now, staleAfterMs = UI_TIMEOUTS.buildProcessTimeout } = input;
  if (live) return { ...live, owned: true };
  if (!row) return null;

  if (row.status === 'queued') {
    return interrupted(
      row,
      `${row.build_id} is no longer queued: the in-memory queue that held it is gone (the server restarted), `
        + 'so it never started (interrupted). Start it again.',
    );
  }

  if (row.status === 'running') {
    const startedMs = Date.parse(row.started_at);
    const age = Number.isNaN(startedMs) ? Infinity : now - startedMs;
    if (age <= staleAfterMs) {
      return { buildId: row.build_id, status: 'running', owned: false, startedAt: row.started_at };
    }
    return interrupted(
      row,
      `${row.build_id} is no longer running: no build in this server holds it and it started more than `
        + `${Math.round(staleAfterMs / 60_000)} min ago (the build watchdog), so the server likely restarted mid-build (interrupted).`,
    );
  }

  return {
    buildId: row.build_id,
    status: row.status as BuildStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    exitCode: row.exit_code,
    errorCount: row.error_count,
    warningCount: row.warning_count,
  };
}
