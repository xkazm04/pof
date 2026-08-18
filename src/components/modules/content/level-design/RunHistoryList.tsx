'use client';

import { CheckCircle2, XCircle, RotateCcw, Link2 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import type { GenerationRunBase } from '@/types/procgen';

interface RunHistoryListProps<T extends GenerationRunBase> {
  runs: T[];
  /** One-line summary of what the run produced (success rows only). */
  describe: (run: T) => string;
  /** Reuse a run's seed in the form above — history IS the seed memory. */
  onReuseSeed: (seed: number) => void;
  /** Shown when the history is empty (no run has been recorded yet). */
  emptyText: string;
  testIdPrefix: string;
}

/**
 * The run ledger, rendered.
 *
 * Both UE panels re-rolled their seed with `Math.random()` and remembered
 * nothing, so the seed behind a good map was gone one click later. This list is
 * that memory — and it shows FAILED runs with their reason rather than letting
 * them vanish, which is the only way "it didn't work" is distinguishable from
 * "nobody ran it".
 */
export function RunHistoryList<T extends GenerationRunBase>({
  runs,
  describe,
  onReuseSeed,
  emptyText,
  testIdPrefix,
}: RunHistoryListProps<T>) {
  return (
    <section className="space-y-2" aria-labelledby={`${testIdPrefix}-heading`}>
      <h4
        id={`${testIdPrefix}-heading`}
        className="text-xs font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-2"
      >
        Run history
      </h4>

      {runs.length === 0 && (
        <p className="text-xs text-violet-400/60" data-testid={`${testIdPrefix}-empty`}>
          {emptyText}
        </p>
      )}

      {runs.length > 0 && (
        <ul className="space-y-1.5" data-testid={`${testIdPrefix}-list`}>
          {runs.map((run) => {
            const Icon = run.success ? CheckCircle2 : XCircle;
            const color = run.success ? STATUS_SUCCESS : STATUS_ERROR;
            return (
              <li
                key={run.id}
                data-testid={`${testIdPrefix}-row-${run.id}`}
                data-outcome={run.success ? 'success' : 'failed'}
                className="flex items-start gap-2 px-3 py-2 rounded-lg border border-violet-900/40 bg-violet-950/20"
              >
                <Icon
                  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                  style={{ color }}
                  role="img"
                  aria-label={run.success ? 'Succeeded' : 'Failed'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-violet-100">
                      {run.success ? describe(run) : 'Failed'}
                    </span>
                    <span className="text-xs text-violet-400/70">seed {run.seed}</span>
                    {run.docId !== null && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-violet-400/70"
                        title={`Linked to level design document #${run.docId}`}
                      >
                        <Link2 className="w-2.5 h-2.5" aria-hidden="true" />
                        doc #{run.docId}
                      </span>
                    )}
                  </div>
                  {/* A failure without its reason is the vanished run all over again. */}
                  {!run.success && (
                    <p
                      className="text-xs text-red-400 mt-0.5 break-words"
                      data-testid={`${testIdPrefix}-reason-${run.id}`}
                    >
                      {run.failureReason || 'No reason was reported.'}
                    </p>
                  )}
                  <p className="text-xs text-violet-500/60 mt-0.5">
                    {run.algorithm || 'generator not recorded'}
                    {run.mapPath ? ` → ${run.mapPath}` : ''} · {run.createdAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReuseSeed(run.seed)}
                  data-testid={`${testIdPrefix}-reuse-${run.id}`}
                  aria-label={`Reuse seed ${run.seed} from the run of ${run.createdAt}`}
                  title={`Reuse seed ${run.seed}`}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium flex-shrink-0 border border-violet-900/50 text-violet-300 hover:text-violet-100 focus-ring"
                >
                  <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
                  Use seed
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
