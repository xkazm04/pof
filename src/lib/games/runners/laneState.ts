/**
 * Pure lane-state derivation for the lanes control room: no fs, no clock (the caller passes `nowMs`).
 * The runner's own words (night/lib.mjs `phaseAt`, `planTimes`) supply the phase; this adds what the runner never
 * prints as one word: is a session writing right now, did the lane report for its deadline, is it blocked.
 */
import { LIVE_WINDOW_S, type LaneIteration, type LanePhase, type LaneState } from '@/lib/games/runners/runnerTypes';

export interface LaneStateInput {
  cwdExists: boolean;
  iterations: number;
  /** `state.json` `reportedFor`: the deadline ISO the lane reported for. */
  reportedFor?: string;
  /** Deadline ISOs this root could be on: the upcoming one and the one 24 h before it. */
  deadlines: readonly string[];
  phase?: LanePhase;
  /** Seconds since the newest session log line; undefined = no session log. */
  liveAgeS?: number;
  lastIteration?: Pick<LaneIteration, 'limited' | 'drained' | 'timedOut' | 'code'>;
  /** Every billing path blocked at read time. */
  billingBlocked: boolean;
  nowMs: number;
  /** Start of the newest iteration, ms. */
  lastStartMs?: number;
}

export function deriveLaneState(i: LaneStateInput): { state: LaneState; note?: string } {
  if (!i.cwdExists) return { state: 'pending', note: 'worktree missing on disk' };
  const live = i.liveAgeS !== undefined && i.liveAgeS <= LIVE_WINDOW_S;
  if (i.reportedFor && i.deadlines.includes(i.reportedFor)) return { state: 'done', note: `reported for ${i.reportedFor}` };
  if (live) return { state: 'running', note: i.phase ? `${i.phase} session writing now` : 'session writing now' };
  if (i.billingBlocked) return { state: 'blocked', note: 'every billing path is blocked; lanes wait for the earliest reset' };
  if (i.lastIteration?.limited) return { state: 'blocked', note: 'the last session hit a usage limit' };
  if (i.iterations === 0) return { state: 'pending', note: 'no session has run yet' };
  const idleMin = i.lastStartMs === undefined ? undefined : Math.round((i.nowMs - i.lastStartMs) / 60_000);
  const idle = idleMin !== undefined && idleMin > 120 ? `last session started ${Math.round(idleMin / 60)} h ago; the runner may be down` : undefined;
  const state: LaneState = i.phase === 'REPORT' ? 'report' : i.phase === 'STABILIZE' ? 'freeze' : 'building';
  return { state, ...(idle ? { note: idle } : {}) };
}

/** The last non-empty line of a journal, capped; undefined when the file is empty. */
export function lastJournalLine(text: string, cap = 300): string | undefined {
  const line = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).at(-1);
  return line === undefined ? undefined : line.length > cap ? `${line.slice(0, cap - 1)}…` : line;
}

/** Sessions that ended in failure: a non-zero exit, or a usage limit. A session stopped at its cap is the design, not a failure; an unknown exit code is not counted. */
export function countFailedSessions(its: ReadonlyArray<{ code?: number | null; timedOut?: boolean; limited?: boolean }>): number {
  return its.filter((i) => i.limited === true || (i.timedOut !== true && typeof i.code === 'number' && i.code !== 0)).length;
}
