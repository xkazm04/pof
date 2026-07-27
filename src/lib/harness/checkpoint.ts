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

/**
 * Tag for the RESUME SNAPSHOT: `harness/<runId>/resume-<stamp>`.
 *
 * Not a green checkpoint — it is the uncommitted tree found when a rehydrated
 * run re-attaches to its ledger. Committing + tagging it keeps that work
 * reachable after a later `rollbackToLastGreen` hard-resets past it, without
 * ever becoming the rollback target itself.
 */
export function resumeSnapshotTag(runId: string, stamp: string): string {
  return `harness/${sanitizeRef(runId)}/resume-${sanitizeRef(stamp)}`;
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
   * FRESH run (empty ledger): create the `harness/<runId>` branch on top of
   * current HEAD and record the pre-run tree as the baseline green checkpoint.
   *
   * RESUME (a ledger was rehydrated from `checkpoints.json`): RE-ATTACH to the
   * existing ledger instead of re-baselining — see the resume-time branch
   * semantics on `createCheckpointer`. Returns false (and stays a no-op) when
   * the project is not a git repo or has no commits to anchor to.
   */
  init(): Promise<boolean>;
  /** True when this checkpointer re-attached to a rehydrated ledger on init(). */
  isResumed(): boolean;
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

/**
 * @param initial A ledger rehydrated from `checkpoints.json` (see
 *   `readCheckpoints`). Passing it is what makes a RESUME roll back to the real
 *   last green: previously the checkpointer always started empty, `init()`
 *   re-`checkout -B`'d the branch and recorded a NEW baseline at the
 *   resume-time tree, so `rollbackToLastGreen` reset to the WRONG commit while
 *   the UI kept showing the stale on-disk ledger. Ignored when its `branch`
 *   doesn't match this run's (a fork owns a different branch).
 *
 * **Resume-time branch semantics** (`init()` with a non-empty ledger):
 * 1. The ledger's last green must still resolve to a commit; if it doesn't
 *    (branch + tags pruned) the ledger is unusable and we fall back to the
 *    fresh-baseline path rather than arm a rollback to a missing object.
 * 2. Re-attach with a PLAIN `checkout <branch>` when the branch exists — never
 *    `checkout -B`, which would move the branch ref to the resume-time HEAD and
 *    orphan every checkpoint commit the ledger names. If the branch is gone but
 *    its commits survive (each green area is tagged), recreate it AT the last
 *    green so branch and ledger agree again.
 * 3. A dirty resume-time tree is committed + tagged as a RESUME SNAPSHOT
 *    (`resumeSnapshotTag`) — reachable after a later hard reset, but never
 *    recorded in the ledger, so it can never become the rollback target. That
 *    work is by definition "since the last green", which is exactly what
 *    rollback is meant to discard.
 * 4. No new baseline is recorded. The rehydrated ledger IS the ledger.
 */
export function createCheckpointer(
  runId: string,
  projectPath: string,
  runGit: GitRunner = defaultGitRunner,
  initial?: CheckpointState | null,
): Checkpointer {
  const branch = checkpointBranch(runId);
  const adopted = initial && initial.branch === branch && initial.checkpoints.length > 0
    ? { branch, checkpoints: [...initial.checkpoints] }
    : null;
  let state: CheckpointState = adopted ?? { branch, checkpoints: [] };
  let ready = false;
  let resumed = false;

  /**
   * Re-attach to a rehydrated ledger (steps 1–3 above). Returns false when the
   * ledger cannot be trusted, so the caller falls back to a fresh baseline.
   */
  async function attachToLedger(priorGreen: string): Promise<boolean> {
    const exists = await runGit(['cat-file', '-e', `${priorGreen}^{commit}`], projectPath);
    if (exists.exitCode !== 0) return false;

    const branchRef = await runGit(['rev-parse', '--verify', `refs/heads/${branch}`], projectPath);
    const checkout = branchRef.exitCode === 0
      ? await runGit(['checkout', branch], projectPath)          // plain — keeps the ledger's commits on the branch
      : await runGit(['checkout', '-B', branch, priorGreen], projectPath); // branch lost; rebuild it at the last green
    if (checkout.exitCode !== 0) return false;

    const status = await runGit(['status', '--porcelain'], projectPath);
    if (status.exitCode === 0 && status.stdout) {
      await runGit(['add', '-A'], projectPath);
      const commit = await runGit(
        ['commit', '-m', `harness resume snapshot: work found on resume (NOT a green checkpoint)`],
        projectPath,
      );
      if (commit.exitCode === 0) {
        await runGit(['tag', '-f', resumeSnapshotTag(runId, Date.now().toString(36))], projectPath);
      }
    }
    return true;
  }

  return {
    async init(): Promise<boolean> {
      // Must be a git repo…
      const isRepo = await runGit(['rev-parse', '--git-dir'], projectPath);
      if (isRepo.exitCode !== 0) return false;
      // …with at least one commit to anchor the baseline to.
      const head = await runGit(['rev-parse', 'HEAD'], projectPath);
      if (head.exitCode !== 0 || !head.stdout) return false;

      // RESUME: re-attach to the rehydrated ledger, never re-baseline over it.
      const priorGreen = lastGreenSha(state);
      if (priorGreen) {
        if (await attachToLedger(priorGreen)) {
          ready = true;
          resumed = true;
          return true;
        }
        // Ledger unusable — drop it and baseline fresh below (an honest new
        // start beats a rollback target that no longer exists).
        state = { branch, checkpoints: [] };
      }

      const checkout = await runGit(['checkout', '-B', branch], projectPath);
      if (checkout.exitCode !== 0) return false;

      // A dirty tree makes bare HEAD a state the working tree never matched —
      // the first rollback would hard-reset away the user's pre-run
      // uncommitted work. Snapshot the dirty tree on the harness branch as
      // the real baseline; if that snapshot cannot be made, refuse to enable
      // checkpointing rather than arm a rollback that destroys it.
      let baselineSha = head.stdout;
      const status = await runGit(['status', '--porcelain'], projectPath);
      if (status.exitCode !== 0) return false;
      if (status.stdout) {
        await runGit(['add', '-A'], projectPath);
        const commit = await runGit(
          ['commit', '-m', `harness checkpoint: ${BASELINE_AREA_ID} (pre-run dirty tree)`],
          projectPath,
        );
        if (commit.exitCode !== 0) return false;
        const newHead = await runGit(['rev-parse', 'HEAD'], projectPath);
        if (newHead.exitCode !== 0 || !newHead.stdout) return false;
        baselineSha = newHead.stdout;
      }

      state = recordCheckpoint(state, {
        areaId: BASELINE_AREA_ID,
        iteration: 0,
        sha: baselineSha,
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

    isResumed() {
      return resumed;
    },

    getState() {
      return { branch: state.branch, checkpoints: [...state.checkpoints] };
    },

    lastGreen() {
      return lastGreenSha(state);
    },
  };
}
