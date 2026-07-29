import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * THE WALK-SUCCESS SIGNAL.
 *
 * Rule 5 says every pipeline is e2e-walked, but the only `validate`-time guard
 * (`pipeline-e2e-coverage.test.ts`) could assert *registration hygiene* — sections, seeds,
 * documented skips — never that a walk actually SUCCEEDED. So the walker could rot for
 * weeks (or grade against a polluted local DB) while `validate` stayed green.
 *
 * The walker therefore records, in this committed file, which pipelines it last walked
 * green. The guard reads it and fails when a registered, non-skipped pipeline is absent —
 * turning "added/changed a pipeline and never walked it" into a red `validate`.
 *
 * Written only after a FULL run (see `writeWalkStatus`), so a `--grep`'d subset can never
 * shrink the record into a false "these are all the pipelines that pass".
 */
export const WALK_STATUS_PATH = resolve(process.cwd(), 'e2e', 'walk-status.json');

export interface WalkStatus {
  /** ISO timestamp of the last full walker run. */
  generatedAt: string;
  /** Catalog ids whose walk test passed in that run, sorted. */
  walked: string[];
  /** The `WALKER_SKIP` map as it stood for that run (catalogId -> documented reason). */
  skipped: Record<string, string>;
}

export function readWalkStatus(): WalkStatus | null {
  try {
    return JSON.parse(readFileSync(WALK_STATUS_PATH, 'utf8')) as WalkStatus;
  } catch {
    return null;
  }
}

/**
 * Record a completed run. `expected` is every non-skipped registered pipeline; when the run
 * did not cover all of them (a `--grep`/`--shard` subset) the file is left untouched, so a
 * partial run can never be mistaken for a full green walk.
 *
 * Returns whether it wrote.
 */
export function writeWalkStatus(walked: Set<string>, expected: string[], skipped: Record<string, string>): boolean {
  if (expected.some((id) => !walked.has(id))) return false;
  const status: WalkStatus = {
    generatedAt: new Date().toISOString(),
    walked: [...walked].sort(),
    skipped,
  };
  writeFileSync(WALK_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  return true;
}
