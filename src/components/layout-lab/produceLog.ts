/**
 * One chronological record of everything an entity's pipeline has actually DONE.
 *
 * Two things were already persisted per step and visible nowhere but the single step you
 * happened to have open:
 *
 *  • `data.produceDirection` — the operator's typed direction plus the prompt it built
 *    (`produceDirection.ts`), reachable only by expanding that step's raw-artifact panel.
 *  • `error` / `syncError` — a produce failure and a write-through failure, shown by
 *    `ProduceErrorBanner` and the sync banner, again only on the open step.
 *
 * So a failure on a step nobody re-opens is invisible, and "what did we ask this pipeline
 * for?" has no answer short of clicking through every step. This module projects the
 * already-persisted artifacts into one ordered list — it introduces NO new truth, reads
 * nothing the store doesn't already hold, and cannot change a status.
 *
 * Ordering is by when the recorded event happened, newest first, which is why a failure
 * needs its own timestamp: `markFailure` deliberately preserves the last successful
 * produce's `at` (the content survived), so without `errorAt` a failure would sort by a
 * time that is not when it failed.
 */

import { readProduceDirection } from '@/lib/catalog/produceDirection';
import type { LabStepArtifact } from './labPipelineStore';

/** What the most recent recorded event on a step was. */
export type ProduceLogOutcome = 'produced' | 'failed' | 'unsynced';

export interface ProduceLogEntry {
  step: string;
  /** Index in the current pipeline, or -1 for a step the pipeline no longer declares
   *  (kept visible on purpose — an orphaned artifact is information, not noise). */
  index: number;
  /** When the recorded event happened (ISO). */
  at: string;
  outcome: ProduceLogOutcome;
  /** Verbatim failure reason; empty for a clean produce. Never paraphrased. */
  reason: string;
  /** Exactly what the operator typed, or '' when nothing was recorded. */
  direction: string;
  /** True only when a real CLI prompt drove this produce (a deterministic one has none). */
  hadPrompt: boolean;
  /** For a failure: does the step still hold content from an earlier successful run? */
  hasContent: boolean;
  /** The server's persisted verdict, when this step has been reconciled against one. */
  status?: string;
  tier?: string;
}

/** Sort key. An unparseable stamp sorts oldest rather than jumping to the front. */
function ms(at: string | undefined): number {
  const n = at ? Date.parse(at) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Project an entity's persisted step artifacts into one newest-first log.
 *
 * A step with neither a successful produce nor a recorded failure is omitted — it has
 * never run, and listing it would turn the log into a copy of the pipeline rail.
 */
export function buildProduceLog(
  steps: readonly string[],
  byStep: Record<string, LabStepArtifact> | undefined,
): ProduceLogEntry[] {
  if (!byStep) return [];
  const indexOf = new Map(steps.map((s, i) => [s, i]));
  const entries: ProduceLogEntry[] = [];

  for (const [step, a] of Object.entries(byStep)) {
    if (!a.done && !a.error) continue; // never ran
    // A produce failure outranks a sync failure: if the produce threw, whether its result
    // would have reached the server is not the operator's problem yet.
    const outcome: ProduceLogOutcome = a.error ? 'failed' : a.syncError ? 'unsynced' : 'produced';
    const dir = readProduceDirection(a.data);
    entries.push({
      step,
      index: indexOf.get(step) ?? -1,
      at: (outcome === 'failed' ? a.errorAt ?? a.at : a.at) ?? '',
      outcome,
      reason: (outcome === 'failed' ? a.error : outcome === 'unsynced' ? a.syncError : '') ?? '',
      direction: dir?.direction ?? '',
      hadPrompt: !!dir?.prompt,
      hasContent: !!a.done,
      ...(a.status ? { status: a.status } : {}),
      ...(a.tier ? { tier: a.tier } : {}),
    });
  }

  return entries.sort((x, y) => ms(y.at) - ms(x.at));
}

export interface ProduceLogSummary {
  total: number;
  produced: number;
  failed: number;
  unsynced: number;
  /** Entries the operator still has to do something about (`failed` + `unsynced`). */
  needsAttention: number;
}

/** Count the log by outcome — the badge that makes an unopened step's failure visible. */
export function summarizeProduceLog(log: readonly ProduceLogEntry[]): ProduceLogSummary {
  const failed = log.filter((e) => e.outcome === 'failed').length;
  const unsynced = log.filter((e) => e.outcome === 'unsynced').length;
  return {
    total: log.length,
    produced: log.filter((e) => e.outcome === 'produced').length,
    failed,
    unsynced,
    needsAttention: failed + unsynced,
  };
}
