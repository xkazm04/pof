'use client';

import { ArrowUp, ArrowDown, Check, History, Minus } from 'lucide-react';
import type { RegressionDiff, SeverityCounts } from '@/lib/evaluator/regression-diff';
import type { FindingSeverity } from '@/lib/evaluator/finding-collector';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SEVERITY_TOKENS, STATUS_SUCCESS } from '@/lib/chart-colors';

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

interface RegressionBannerProps {
  diff: RegressionDiff;
  view: 'new' | 'all';
  onViewChange: (view: 'new' | 'all') => void;
  /** Total findings in the current scan (label for the "All" toggle). */
  totalFindings: number;
}

/**
 * Compact regression summary shown above the results tree: what's NEW since the
 * last scan (per severity), how many issues RESOLVED, and how many PERSIST — plus
 * a New / All view toggle. Deltas pair color with an arrow + word so the meaning
 * never rides on hue alone (WCAG 1.4.1).
 */
export function RegressionBanner({ diff, view, onViewChange, totalFindings }: RegressionBannerProps) {
  const { hasPrevious, summary } = diff;
  const noChange = hasPrevious && summary.newTotal === 0 && summary.resolvedTotal === 0;

  return (
    <SurfaceCard data-testid="pof-regression-banner" className="p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <History className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-semibold text-text">Since last scan</span>
        </div>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {!hasPrevious ? (
            <span className="text-xs text-text-muted">
              Baseline scan recorded — {totalFindings} finding{totalFindings === 1 ? '' : 's'} tracked. Re-run after
              changes to see what&apos;s new.
            </span>
          ) : noChange ? (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Minus className="w-3 h-3" />
              No change since last scan
            </span>
          ) : (
            <>
              {/* New, per severity (worse → regressions stand out) */}
              {newSeverityChips(summary.new).length > 0 ? (
                newSeverityChips(summary.new).map(({ sev, count }) => {
                  const tok = SEVERITY_TOKENS[sev];
                  return (
                    <span
                      key={sev}
                      className="flex items-center gap-0.5 text-2xs font-bold px-1.5 py-0.5 rounded"
                      style={{ color: tok.color, backgroundColor: tok.bg }}
                      title={`${count} new ${sev} since last scan`}
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                      {count} {sev}
                    </span>
                  );
                })
              ) : (
                <span className="flex items-center gap-1 text-2xs text-text-muted">
                  <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
                  No new issues
                </span>
              )}

              {/* Resolved */}
              {summary.resolvedTotal > 0 && (
                <span
                  className="flex items-center gap-0.5 text-2xs font-bold px-1.5 py-0.5 rounded"
                  style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}1a` }}
                  title={`${summary.resolvedTotal} findings resolved since last scan`}
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                  {summary.resolvedTotal} resolved
                </span>
              )}

              {/* Persisting (muted, no delta) */}
              {summary.persistingTotal > 0 && (
                <span className="text-2xs text-text-muted">{summary.persistingTotal} persisting</span>
              )}
            </>
          )}
        </div>

        {/* ── View toggle ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <ViewToggleButton
            testId="pof-regression-view-new"
            active={view === 'new'}
            onClick={() => onViewChange('new')}
            label={`New (${summary.newTotal})`}
          />
          <ViewToggleButton
            testId="pof-regression-view-all"
            active={view === 'all'}
            onClick={() => onViewChange('all')}
            label={`All (${totalFindings})`}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

function ViewToggleButton({
  testId,
  active,
  onClick,
  label,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-colors border ${
        active
          ? 'bg-surface text-text border-border-bright'
          : 'bg-background text-text-muted border-border hover:text-text'
      }`}
    >
      {label}
    </button>
  );
}

function newSeverityChips(counts: SeverityCounts): { sev: FindingSeverity; count: number }[] {
  return SEVERITY_ORDER.map((sev) => ({ sev, count: counts[sev] })).filter(({ count }) => count > 0);
}
