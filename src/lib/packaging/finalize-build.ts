// Server-only: the ONE place a finished cook becomes a build_history row.
//
// The interactive cook (`/api/packaging/execute`) and the nightly runner
// (`scheduled-build-runner.ts`) each used to finalize inline, and every rule landed
// on one side only: the nightly writer never stamped a version, and its size
// verdicts compared against a bare number whose build and project it could not name.
// Both callers now route their terminal outcome through `finalizeCook`, so the next
// finalization rule is written once.
//
// Rules, in order:
//   1. The size baseline is captured BEFORE the insert (otherwise the just-recorded
//      green row becomes its own baseline and growth always reads 0%), scoped to the
//      project, and only when the cook produced a measurable size.
//   2. Growth is evaluated against the baseline RECORD, so every verdict names build #N.
//   3. VERSION SEMANTICS: bump-per-green-cook — only a build RECORDED green carries a
//      version; failed, cancelled and smoke-failed builds are recorded unversioned.

import type { BuildRecordInput } from './build-history-store';
import { describeSizeBaseline, type SizeBaselineRef, type SizeRegression } from './size-budgets';

/** Terminal outcome of a cook (or of a gate that stopped it before cooking). */
export type CookFinalOutcome =
  | { kind: 'done'; exePath: string | null; durationMs: number; sizeBytes: number | null; cookTimeMs?: number | null }
  | { kind: 'error'; status: 'failed' | 'cancelled'; message: string; durationMs?: number | null; cookTimeMs?: number | null };

export interface FinalizeContext {
  projectPath: string;
  platform: string;
  config: string;
  /** Smoke verdict for a runnable build; a failed smoke records the build as failed. */
  smoke?: { failed: boolean; note: string } | null;
  /** Leading note parts (e.g. the nightly tag); the smoke and size notes follow. */
  notes?: string[];
}

export interface FinalizeDeps {
  lastGreenBaseline: (platform: string, projectId: string) => SizeBaselineRef | null;
  evaluateBuildSize: (
    platform: string, sizeBytes: number, lastGreen: number | null, baseline: SizeBaselineRef | null,
  ) => SizeRegression | null;
  nextVersion: () => string;
  insertBuild: (input: BuildRecordInput) => { id: number };
}

export interface FinalizeResult {
  buildId: number;
  status: BuildRecordInput['status'];
  version: string | null;
  /** The baseline the size check used — null when there was none or no size was measured. */
  baseline: SizeBaselineRef | null;
  /** Plain statement of the baseline — null when the cook produced no measurable size. */
  baselineNote: string | null;
  regression: SizeRegression | null;
}

const NOTE_JOIN = ' | ';

export function finalizeCook(
  outcome: CookFinalOutcome,
  ctx: FinalizeContext,
  deps: FinalizeDeps,
): FinalizeResult {
  const { projectPath, platform, config } = ctx;
  const lead = ctx.notes ?? [];

  if (outcome.kind === 'error') {
    const rec = deps.insertBuild({
      projectId: projectPath, platform, config,
      // 'cancelled' (user abort / client gone) must not pollute the failure stats.
      status: outcome.status,
      durationMs: outcome.durationMs ?? null,
      cookTimeMs: outcome.cookTimeMs ?? null,
      errorSummary: outcome.message,
      version: null,
      notes: lead.length ? lead.join(NOTE_JOIN) : null,
    });
    return { buildId: rec.id, status: outcome.status, version: null, baseline: null, baselineNote: null, regression: null };
  }

  const sizeBytes = outcome.sizeBytes && outcome.sizeBytes > 0 ? outcome.sizeBytes : null;
  const baseline = sizeBytes != null ? deps.lastGreenBaseline(platform, projectPath) : null;
  const regression = sizeBytes != null
    ? deps.evaluateBuildSize(platform, sizeBytes, baseline?.sizeBytes ?? null, baseline)
    : null;

  const smokeFailed = ctx.smoke?.failed === true;
  const status: BuildRecordInput['status'] = smokeFailed ? 'failed' : 'success';
  const version = status === 'success' ? deps.nextVersion() : null;

  const noteParts = [...lead];
  if (ctx.smoke) noteParts.push(ctx.smoke.note);
  if (regression) noteParts.push(regression.note);

  const rec = deps.insertBuild({
    projectId: projectPath, platform, config, status,
    sizeBytes: outcome.sizeBytes,
    durationMs: outcome.durationMs,
    cookTimeMs: outcome.cookTimeMs ?? outcome.durationMs,
    outputPath: outcome.exePath || null,
    errorSummary: smokeFailed && ctx.smoke ? ctx.smoke.note : null,
    version,
    notes: noteParts.length ? noteParts.join(NOTE_JOIN) : null,
  });

  return {
    buildId: rec.id, status, version, baseline,
    baselineNote: sizeBytes != null ? describeSizeBaseline(baseline) : null,
    regression,
  };
}
