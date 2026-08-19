/**
 * Durable storage for experiment captures.
 *
 * Captures used to be written to `tmpdir()` and that absolute temp path persisted into the run
 * history. Windows cleans `%TEMP%`, so **every historical run degraded**: `hasScreenshot` was
 * derived from "path is non-null" rather than file existence, so the history kept rendering an
 * `<img>` that 404'd, A-B compare (the feature's entire premise) showed a broken image with no
 * explanation — and the verdict text survived, so old runs went on asserting "visual: pass" with
 * the evidence gone. A pass you can no longer audit is the quiet end of the lie class.
 *
 * Captures now live under `~/.pof/experiments/` (the house precedent — `~/.pof/audio/<setId>/`),
 * named by the run id so a capture is traceable to its row without a lookup.
 *
 * **Retention: unbounded, deliberately, with explicit deletion.** A run costs one DB row plus one
 * ~400 KB PNG, and the value of the history is precisely that an old baseline is still there to
 * compare against — a silent eviction policy would recreate the missing-evidence problem this
 * direction exists to remove. Deletion is therefore a user action: `deleteExperimentRun` (which
 * was dead code) is wired to `DELETE /api/experiment/runs/:id` and removes the row AND its
 * capture, only ever inside the durable root.
 */
import { existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { logger } from '@/lib/logger';

/** Durable, app-owned capture root. */
export const EXPERIMENT_CAPTURE_DIR = join(homedir(), '.pof', 'experiments');

/**
 * Roots a stored capture path is allowed to resolve inside. The durable root is where every NEW
 * capture is written; the OS temp dir is kept ONLY so pre-migration rows whose file still exists
 * keep rendering (no capture is deleted or orphaned by this change — see the direction's
 * non-goals). A path outside both is refused rather than served.
 */
export function servableCaptureRoots(): string[] {
  return [EXPERIMENT_CAPTURE_DIR, tmpdir()];
}

/** Create the durable root if needed. Returns it. */
export function ensureCaptureDir(): string {
  if (!existsSync(EXPERIMENT_CAPTURE_DIR)) mkdirSync(EXPERIMENT_CAPTURE_DIR, { recursive: true });
  return EXPERIMENT_CAPTURE_DIR;
}

/** Where a python-mode run's single PNG lives. Forward slashes: the path is embedded in Python. */
export function captureFileFor(runId: string): string {
  return join(EXPERIMENT_CAPTURE_DIR, `${safeRunId(runId)}.png`).replace(/\\/g, '/');
}

/** Where a scenario-mode run's shot directory lives (the UE side writes `shot_NN.png` into it). */
export function captureDirFor(runId: string): string {
  return join(EXPERIMENT_CAPTURE_DIR, safeRunId(runId)).replace(/\\/g, '/');
}

/** Run ids are app-generated (`exp-<ts>-<rand>`); this refuses anything that could escape the root. */
export function safeRunId(runId: string): string {
  // Separators go first, then any `..` run — so neither a path segment nor a parent reference
  // can survive into a filename. Refuses by not matching; nothing is "cleaned up" into a
  // different-but-still-traversing form.
  const safe = runId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '_');
  return safe === '' || safe === '.' ? 'run' : safe;
}

/**
 * Whether a stored capture path may be served: its REAL path must sit inside a real allowed root.
 * Same discipline as `/api/visual-gen/asset/:name` — it refuses by not matching (no sanitising),
 * and the realpath re-check also refuses a symlink pointing out of the root.
 */
export function isServableCapture(path: string): boolean {
  let real: string;
  try { real = realpathSync(path); } catch { return false; }
  for (const root of servableCaptureRoots()) {
    let realRoot: string;
    try { realRoot = realpathSync(root); } catch { continue; }
    if (real === realRoot || real.startsWith(realRoot + sep)) return true;
  }
  return false;
}

/**
 * What a run's evidence actually is right now:
 *  - `none`      — the run never captured a frame;
 *  - `present`   — the file is on disk and servable;
 *  - `missing`   — a path was recorded but the file is gone (or outside the servable roots).
 *
 * `missing` is the state the old `hasScreenshot` (path-non-null) silently reported as `present`.
 */
export type CaptureState = 'none' | 'present' | 'missing';

export function captureStateOf(path: string | null | undefined): CaptureState {
  if (!path) return 'none';
  return isServableCapture(path) ? 'present' : 'missing';
}

/**
 * Delete a run's capture, if it is inside the DURABLE root. A legacy temp path is left alone —
 * PoF did not choose where it went and must not reach outside its own storage to delete.
 * Returns whether anything was removed.
 */
export function deleteCaptureFor(runId: string): boolean {
  const id = safeRunId(runId);
  let removed = false;
  for (const target of [join(EXPERIMENT_CAPTURE_DIR, `${id}.png`), join(EXPERIMENT_CAPTURE_DIR, id)]) {
    if (!existsSync(target)) continue;
    try {
      rmSync(target, { recursive: true, force: true });
      removed = true;
    } catch (e) {
      logger.debug(`[ue-experiment] could not remove capture ${target}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return removed;
}
