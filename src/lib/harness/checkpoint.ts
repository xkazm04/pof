/**
 * Git checkpoint — per-area snapshots with rollback-to-last-green.
 *
 * After an area passes its required gates the orchestrator commits the working
 * tree onto a dedicated `harness/<runId>` branch, tagged with the areaId. The
 * SHA of every such commit is a "green" checkpoint. When a later area (or its
 * self-heal pass) leaves gates red and retries are exhausted, the orchestrator
 * `git reset --hard`s back to the most recent green checkpoint *before*
 * promoting-with-gaps — so a bad session can never corrupt earlier passing work.
 *
 * Design mirrors the cost governor in `orchestrator.ts`: pure, unit-testable
 * helpers (ref naming + last-green bookkeeping) sit alongside a thin stateful
 * `Checkpointer` whose git execution is injectable for tests.
 *
 * NOTE: rollback assumes sequential execution (maxConcurrent = 1). A hard reset
 * would clobber a sibling area's in-flight changes, so checkpoint mode is meant
 * for one-area-at-a-time runs.
 */

import { execFile } from 'child_process';

// ── Git runner (injectable) ─────────────────────────────────────────────────

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs a git subcommand (args, no leading `git`) in `cwd`. */
export type GitRunner = (args: string[], cwd: string) => Promise<GitResult>;

function defaultGitRunner(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === 'number'
        ? (error as { code: number }).code
        : error ? 1 : 0;
      resolve({
        stdout: (stdout ?? '').toString().trim(),
        stderr: (stderr ?? '').toString().trim(),
        exitCode: code,
      });
    });
  });
}

// ── Ref naming (pure) ────────────────────────────────────────────────────────

/** AreaId stamped on the pre-run baseline checkpoint (the last-known-good tree). */
export const BASELINE_AREA_ID = '__baseline__';

/**
 * Make a string safe for use as one segment of a git refname: replace any char
 * git forbids with `-`, collapse repeats, and trim leading/trailing separators.
 */
function sanitizeRef(s: string): string {
  const cleaned = s
    .replace(/[^A-Za-z0-9._-]+/g, '-') // forbidden chars → dash
    .replace(/\.{2,}/g, '.')           // collapse `..` (illegal in refs)
    .replace(/-{2,}/g, '-')            // collapse runs of dashes
    .replace(/^[-.]+|[-.]+$/g, '');    // trim leading/trailing - or .
  return cleaned || 'x';
}

/** Branch every checkpoint for a run lives on: `harness/<runId>`. */
export function checkpointBranch(runId: string): string {
  return `harness/${sanitizeRef(runId)}`;
}

/** Tag for one area's checkpoint: `harness/<runId>/<areaId>-iter<n>`. */
export function checkpointTag(runId: string, areaId: string, iteration: number): string {
  return `harness/${sanitizeRef(runId)}/${sanitizeRef(areaId)}-iter${iteration}`;
}

// ── Checkpoint state (pure) ────────────────────────────────────────────────────

export interface GitCheckpoint {
  areaId: string;
  iteration: number;
  /** Full commit SHA this checkpoint points at. */
  sha: string;
  /** Tag applied to the commit (empty for the baseline). */
  tag: string;
  timestamp: string;
}

export interface CheckpointState {
  /** The harness branch all checkpoints live on. */
  branch: string;
  /** Green checkpoints in chronological order (most recent last). */
  checkpoints: GitCheckpoint[];
}

/** SHA of the most recent green checkpoint, or null when there are none. */
export function lastGreenSha(state: CheckpointState): string | null {
  if (state.checkpoints.length === 0) return null;
  return state.checkpoints[state.checkpoints.length - 1].sha;
}

/** Append a checkpoint, returning a new state (does not mutate the input). */
export function recordCheckpoint(state: CheckpointState, checkpoint: GitCheckpoint): CheckpointState {
  return { branch: state.branch, checkpoints: [...state.checkpoints, checkpoint] };
}

// ── Checkpointer (stateful) ────────────────────────────────────────────────────

export interface Checkpointer {
  /**
   * Create the `harness/<runId>` branch on top of current HEAD and record the
   * pre-run tree as the baseline green checkpoint. Returns false (and stays a
   * no-op) when the project is not a git repo or has no commits to anchor to.
   */
  init(): Promise<boolean>;
  /**
   * Commit + tag the current working tree as a green checkpoint for `areaId`.
   * Returns the checkpoint, or null if checkpointing is disabled or the commit
   * failed (the loop continues either way — snapshots are best-effort).
   */
  commitArea(areaId: string, iteration: number): Promise<GitCheckpoint | null>;
  /**
   * `git reset --hard` to the most recent green checkpoint, discarding any
   * changes made since. Returns the SHA reset to, or null when there is nothing
   * to roll back to (e.g. checkpointing disabled).
   */
  rollbackToLastGreen(): Promise<string | null>;
  /** Current checkpoint state (for persistence / inspection). */
  getState(): CheckpointState;
  /** Convenience accessor for the most recent green SHA. */
  lastGreen(): string | null;
}

export function createCheckpointer(
  runId: string,
  projectPath: string,
  runGit: GitRunner = defaultGitRunner,
): Checkpointer {
  const branch = checkpointBranch(runId);
  let state: CheckpointState = { branch, checkpoints: [] };
  let ready = false;

  return {
    async init(): Promise<boolean> {
      // Must be a git repo…
      const isRepo = await runGit(['rev-parse', '--git-dir'], projectPath);
      if (isRepo.exitCode !== 0) return false;
      // …with at least one commit to anchor the baseline to.
      const head = await runGit(['rev-parse', 'HEAD'], projectPath);
      if (head.exitCode !== 0 || !head.stdout) return false;

      const checkout = await runGit(['checkout', '-B', branch], projectPath);
      if (checkout.exitCode !== 0) return false;

      state = recordCheckpoint(state, {
        areaId: BASELINE_AREA_ID,
        iteration: 0,
        sha: head.stdout,
        tag: '',
        timestamp: new Date().toISOString(),
      });
      ready = true;
      return true;
    },

    async commitArea(areaId: string, iteration: number): Promise<GitCheckpoint | null> {
      if (!ready) return null;
      const tag = checkpointTag(runId, areaId, iteration);

      await runGit(['add', '-A'], projectPath);
      const commit = await runGit(
        ['commit', '--allow-empty', '-m', `harness checkpoint: ${areaId} @ iter ${iteration}`],
        projectPath,
      );
      if (commit.exitCode !== 0) return null;

      await runGit(['tag', '-f', tag], projectPath);
      const head = await runGit(['rev-parse', 'HEAD'], projectPath);
      if (head.exitCode !== 0 || !head.stdout) return null;

      const checkpoint: GitCheckpoint = {
        areaId,
        iteration,
        sha: head.stdout,
        tag,
        timestamp: new Date().toISOString(),
      };
      state = recordCheckpoint(state, checkpoint);
      return checkpoint;
    },

    async rollbackToLastGreen(): Promise<string | null> {
      const sha = lastGreenSha(state);
      if (!sha) return null;
      const reset = await runGit(['reset', '--hard', sha], projectPath);
      if (reset.exitCode !== 0) return null;
      return sha;
    },

    getState() {
      return { branch: state.branch, checkpoints: [...state.checkpoints] };
    },

    lastGreen() {
      return lastGreenSha(state);
    },
  };
}
