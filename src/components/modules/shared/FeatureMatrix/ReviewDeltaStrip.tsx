'use client';

import { createContext, useContext } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { STATUS_ERROR, STATUS_NEUTRAL, STATUS_SUCCESS, STATUS_WARNING, statusBg, statusBorder } from '@/lib/chart-colors';
import { changedFeatureNames, deltaToastType, summarizeDelta } from '@/lib/feature-review-delta';
import type { ReviewDelta } from '@/lib/feature-review-delta';
import type { FeatureStatus } from '@/types/feature-matrix';

/** Rows the last review regressed, keyed by feature name -> the status it held before. */
const NO_REGRESSIONS: ReadonlyMap<string, FeatureStatus> = new Map();
export const RegressionContext = createContext<ReadonlyMap<string, FeatureStatus>>(NO_REGRESSIONS);

/** The status a row held before the last review regressed it, if it did. */
export function useRegressedFrom(featureName: string): FeatureStatus | undefined {
  return useContext(RegressionContext).get(featureName);
}

const MAX_LINES = 6;

/**
 * "Since last review: 1 regressed, 0 improved" — what the newest review/fix event
 * MOVED, read from the history route's per-feature delta. "Show changed" narrows
 * the matrix to the moved rows. An unmeasured pair (its older snapshot predates
 * per-feature capture) states its reason and offers no filter; fewer than two
 * snapshots renders nothing — there is no "last review" to compare with.
 */
export function ReviewDeltaStrip({
  delta,
  changedOnly,
  onToggleChanged,
}: {
  delta: ReviewDelta | null;
  changedOnly: boolean;
  onToggleChanged: () => void;
}) {
  if (!delta || (!delta.measured && !delta.fromReviewedAt)) return null;

  const tone = !delta.measured ? STATUS_NEUTRAL : deltaToastType(delta) === 'warning' ? STATUS_WARNING : STATUS_SUCCESS;
  const changed = changedFeatureNames(delta);
  const lines = delta.measured
    ? [
        ...delta.regressed.map((m) => ({ text: `${m.featureName}: ${m.from} -> ${m.to}`, color: STATUS_ERROR })),
        ...delta.qualityDropped.map((m) => ({ text: `${m.featureName}: quality ${m.from} -> ${m.to}`, color: STATUS_WARNING })),
        ...delta.improved.map((m) => ({ text: `${m.featureName}: ${m.from} -> ${m.to}`, color: STATUS_SUCCESS })),
      ]
    : [];

  return (
    <div
      data-testid="pof-review-delta-strip"
      data-measured={delta.measured ? 'true' : 'false'}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs"
      style={{ backgroundColor: statusBg(tone), border: `1px solid ${statusBorder(tone)}` }}
    >
      <GitCompareArrows className="w-3.5 h-3.5 flex-shrink-0 mt-px" style={{ color: tone }} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-text">
          <span className="font-semibold">Since last review: </span>
          {delta.measured
            ? changed.size > 0
              ? summarizeDelta(delta)
              : 'no feature changed status or quality'
            : `not measured. ${delta.reason}`}
        </p>
        {lines.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs">
            {lines.slice(0, MAX_LINES).map((l) => (
              <li key={l.text} style={{ color: l.color }}>{l.text}</li>
            ))}
            {lines.length > MAX_LINES && <li className="text-text-muted">+{lines.length - MAX_LINES} more</li>}
          </ul>
        )}
      </div>
      {delta.measured && changed.size > 0 && (
        <button
          type="button"
          onClick={onToggleChanged}
          aria-pressed={changedOnly}
          className="flex-shrink-0 px-2 py-0.5 rounded-md text-2xs font-medium border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2"
        >
          {changedOnly ? 'Show all' : `Show changed (${changed.size})`}
        </button>
      )}
    </div>
  );
}
