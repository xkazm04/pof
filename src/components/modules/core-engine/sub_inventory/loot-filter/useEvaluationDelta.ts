import { useEffect, useState } from 'react';
import { diffEvaluations, type ActionChange } from '@/lib/loot-filter/impact';
import type { FilterEvaluation } from '@/lib/loot-filter/types';

/** How long the delta chip stays up after an edit. */
export const DELTA_VISIBLE_MS = 6000;

export interface EvaluationDelta {
  shown: number;
  highlighted: number;
  hidden: number;
  changed: number;
  changes: ActionChange[];
}

function computeDelta(prev: FilterEvaluation, next: FilterEvaluation): EvaluationDelta | null {
  const changes = diffEvaluations(prev, next);
  if (changes.length === 0) return null;
  return {
    shown: next.shown - prev.shown,
    highlighted: next.highlighted - prev.highlighted,
    hidden: next.hidden - prev.hidden,
    changed: changes.length,
    changes,
  };
}

/**
 * The effect of the latest edit: tally deltas and flipped items versus the previous evaluation.
 * Null on first render and when no action changed; transient - cleared after DELTA_VISIBLE_MS
 * or replaced by the next evaluation, whichever comes first.
 */
export function useEvaluationDelta(evaluation: FilterEvaluation, visibleMs = DELTA_VISIBLE_MS): EvaluationDelta | null {
  const [state, setState] = useState<{ seen: FilterEvaluation; delta: EvaluationDelta | null }>({ seen: evaluation, delta: null });
  let delta = state.delta;
  if (state.seen !== evaluation) {
    delta = computeDelta(state.seen, evaluation);
    setState({ seen: evaluation, delta });
  }

  useEffect(() => {
    if (!state.delta) return;
    const t = setTimeout(() => setState((s) => ({ ...s, delta: null })), visibleMs);
    return () => clearTimeout(t);
  }, [state.delta, visibleMs]);

  return delta;
}
