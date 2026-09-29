'use client';

import { useCallback } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import {
  buildOverwriteMergePrompt, lossCount, type MergeTarget, type OverwriteReview as Review,
} from '@/lib/blueprint-transpiler/overwrite-review';
import { STATUS_SUCCESS, STATUS_WARNING, OPACITY_10, OPACITY_15, OPACITY_30 } from '@/lib/chart-colors';
import { ACCENT } from './constants';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The non-destructive door: a user-clicked CLI task that folds the generated
 * members into the existing class. The app itself writes nothing here — the
 * only UE write is whatever that clicked task does.
 */
function MergeViaClaudeButton({ review, target, onDispatched }: {
  review: Review; target: MergeTarget; onDispatched: () => void;
}) {
  const { execute, isRunning } = useModuleCLI({
    moduleId: 'blueprint-transpiler', sessionKey: 'blueprint-overwrite-merge', label: 'Merge Blueprint', accentColor: ACCENT,
  });
  const merge = useCallback(() => {
    if (isRunning) return;
    const prompt = buildOverwriteMergePrompt(review, target);
    void execute(TaskFactory.askClaude('blueprint-transpiler', prompt, `Merge ${target.className} (keep ${plural(lossCount(review), 'member')})`));
    onDispatched();
  }, [isRunning, review, target, execute, onDispatched]);
  return (
    <button
      type="button"
      onClick={merge}
      disabled={isRunning}
      className="flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors disabled:opacity-40 flex-shrink-0"
      style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
      title="Open a Claude task that merges the generated code into the existing files and keeps the members listed here"
    >
      <GitMerge className="w-3 h-3" /> Merge via Claude
    </button>
  );
}

/**
 * Member-level verdict above the line diff: which hand-written UPROPERTY /
 * UFUNCTION members, specifiers and .cpp definitions the whole-file overwrite
 * deletes. A new file renders nothing (today's modal).
 */
export function OverwriteReviewPanel({ review, target, acknowledged, onAcknowledge, onMergeDispatched }: {
  review: Review;
  target: MergeTarget;
  acknowledged: boolean;
  onAcknowledge: (next: boolean) => void;
  onMergeDispatched: () => void;
}) {
  if (review.verdict === 'new-file') return null;
  if (review.verdict === 'no-loss') {
    return (
      <div data-testid="overwrite-review" className="flex items-start gap-1.5 mb-3 text-2xs" style={{ color: STATUS_SUCCESS }}>
        <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-px" />
        <span>Every UPROPERTY / UFUNCTION and {target.className}:: definition on disk survives this overwrite. <span className="text-text-muted">{review.boundary}</span></span>
      </div>
    );
  }
  const n = lossCount(review);
  return (
    <div
      data-testid="overwrite-review"
      className="rounded-lg px-3 py-2 mb-3 text-2xs space-y-1.5"
      style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, border: `1px solid ${STATUS_WARNING}${OPACITY_30}` }}
    >
      <div className="flex items-center gap-1.5 font-medium" style={{ color: STATUS_WARNING }}>
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> This overwrite drops {plural(n, 'hand-written member')}
      </div>
      {review.lost.length > 0 && (
        <div>
          <span className="text-text-muted">{target.relPaths.header} loses:</span>
          <ul className="font-mono pl-3">
            {review.lost.map((m) => (
              <li key={`${m.owner}:${m.kind}:${m.name}`}>
                {m.signature}{m.specifiers.length > 0 && <span className="text-text-muted"> [{m.specifiers.join(', ')}]</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.changed.length > 0 && (
        <div>
          <span className="text-text-muted">Kept but stripped of specifiers:</span>
          <ul className="font-mono pl-3">
            {review.changed.map((c) => <li key={`${c.owner}:${c.kind}:${c.name}`}>{c.name} loses {c.droppedSpecifiers.join(', ')}</li>)}
          </ul>
        </div>
      )}
      {review.lostDefinitions.length > 0 && (
        <div>
          <span className="text-text-muted">{target.relPaths.source} loses definitions:</span>{' '}
          <span className="font-mono">{review.lostDefinitions.map((d) => `${d}()`).join(', ')}</span>
        </div>
      )}
      <p className="text-text-muted">{review.boundary}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: STATUS_WARNING }}>
          <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} className="focus-ring" />
          Overwrite and drop {plural(n, 'member')}
        </label>
        <MergeViaClaudeButton review={review} target={target} onDispatched={onMergeDispatched} />
      </div>
    </div>
  );
}
