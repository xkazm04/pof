/**
 * Lane runners — the wire shape of the Game home's "Lanes control room" (client-safe: no fs).
 *
 * A runner root is a `night.mjs --root R` folder (`games/gtai/night/`): `night.json` lists lanes, each lane is a
 * loop of headless Claude sessions in its own git worktree, and the runner writes `logs/<lane>/state.json`.
 * The server reader (`readRunners.ts`) turns those files into this shape; nothing here reads a clock, so the
 * client never invents an age (`readAt` is the server's).
 *
 * Absent-value convention: OMIT a key for "not applicable"/"not there yet" (`lastCommit`, `report`, `schedule`).
 * `null` is not used on the wire.
 */

/** Phase the runner clock is in at read time (`phaseAt` in night/lib.mjs). */
export type LanePhase = 'BUILD' | 'STABILIZE' | 'REPORT';

/**
 * - `running`  a session is writing its log right now (see `LIVE_WINDOW_S`)
 * - `building` BUILD phase, no session writing at the moment (between sessions, or the runner is down)
 * - `freeze`   STABILIZE phase (past the freeze)
 * - `report`   REPORT phase, not yet reported
 * - `done`     the lane reported for this deadline
 * - `blocked`  every billing path is blocked, or the last session hit a usage limit
 * - `pending`  no iteration has run yet / the lane's worktree is missing
 */
export type LaneState = 'running' | 'building' | 'freeze' | 'report' | 'done' | 'blocked' | 'pending';

/** A session whose newest log line is younger than this counts as running. */
export const LIVE_WINDOW_S = 300;

export interface LaneIteration {
  n: number;
  phase: LanePhase | string;
  billing: 'api' | 'subscription' | string;
  /** Process exit code; `timedOut` iterations are the cap, not a failure. */
  code: number | null;
  timedOut: boolean;
  limited: boolean;
  drained: boolean;
  wallS: number;
  /** ISO. */
  start: string;
}

export interface LaneCommit {
  sha: string;
  subject: string;
  /** ISO committer date. */
  at: string;
}

export interface LaneReport {
  bytes: number;
  /** ISO. */
  mtime: string;
  /** The first `REPORT_EXCERPT_CHARS` characters. */
  excerpt: string;
  truncated: boolean;
}

export const REPORT_EXCERPT_CHARS = 6000;

export interface LaneFrame {
  file: string;
  title: string;
  source?: string;
  note?: string;
  /** The paired "before" frame's file, when the entry names one that is servable. */
  before?: string;
  /** Served by `GET /api/games/<id>/lanes/frame?lane=&file=`; both files come from the lane's frames.json. */
  url: string;
  beforeUrl?: string;
}

export interface LaneView {
  id: string;
  /** The runner root's folder name (`gtai-night`). */
  rootName: string;
  model: string;
  effort?: string;
  cwd: string;
  cwdExists: boolean;
  branch?: string;
  state: LaneState;
  /** Why the state is what it is, in words (blocked reason, missing worktree, ...). */
  stateNote?: string;
  phase?: LanePhase;
  iterations: number;
  /** Sum of `costUsd` over the lane's iterations. */
  costUsd: number;
  /** The part of it billed against the API key (the rest rode the subscription). */
  apiCostUsd: number;
  lastIteration?: LaneIteration;
  lastCommit?: LaneCommit;
  lastJournalLine?: string;
  report?: LaneReport;
  frames: LaneFrame[];
  /** The lane worktree has a `build/evidence/` folder: the build-health panel can show it. */
  hasEvidence: boolean;
}

export interface RunnerSchedule {
  /** ISO. */
  freeze: string;
  report: string;
  until: string;
  /** `launch.cmd` = parsed from the root's launch command; `default` = night.mjs defaults (09:00/07:30/08:15). */
  source: 'launch.cmd' | 'default';
}

export interface RunnerBilling {
  /** night.mjs `billing.line()`-style words, e.g. `API key blocked until 11:15, subscription free`. */
  line: string;
  /** ISO of the block's end per path; omitted when the path is free. */
  apiBlockedUntil?: string;
  subscriptionBlockedUntil?: string;
  apiReason?: string;
}

export interface RunnerRootView {
  /** Absolute path of the root. */
  root: string;
  name: string;
  /** False when the folder or its `night.json` could not be read; `error` says why and `lanes` is empty. */
  ok: boolean;
  error?: string;
  schedule?: RunnerSchedule;
  phase?: LanePhase;
  billing?: RunnerBilling;
  lanes: LaneView[];
}

export interface LanesBoard {
  gameId: string;
  /** ISO, the server's clock at read. */
  readAt: string;
  /** False when the game declares no runners; `reason` says so. */
  configured: boolean;
  reason?: string;
  roots: RunnerRootView[];
  /** Absolute masters folder, when one is declared and on disk. */
  masters?: string;
}

const STATE_WORD: Record<LaneState, string> = {
  running: 'running', building: 'building', freeze: 'freeze', report: 'report', done: 'done', blocked: 'blocked', pending: 'pending',
};
export const laneStateWord = (s: LaneState): string => STATE_WORD[s];

/** "$3.20 ($1.10 API key)" — an unmeasured cost is never shown as free. */
export function costText(costUsd: number, apiCostUsd: number, iterations: number): string {
  if (iterations === 0) return 'no sessions yet';
  return `$${costUsd.toFixed(2)} ($${apiCostUsd.toFixed(2)} API key)`;
}
