'use client';

import { Microscope, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ScanDelta } from '@/lib/evaluator/scan-delta';
import {
  STATUS_INFO, STATUS_WARNING, STATUS_SUCCESS, STATUS_BLOCKER,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';

/**
 * Deep-eval scan regressions — an ADDITIONAL, clearly-labelled source in the
 * Regression Tracker (which otherwise runs off playtest/crash sessions). Reads the
 * evaluator scan-delta feed (`/api/evaluator/deltas`, derived from the durable
 * evaluator_results history) so a code-quality scan's NEW/RESOLVED findings sit
 * next to gameplay regressions. Empty history → renders nothing (view unchanged).
 */
export function EvaluatorScanDeltas({ deltas }: { deltas: ScanDelta[] }) {
  if (deltas.length === 0) return null;

  // deltas are newest-first; the first is the most recent scan.
  const [latest, ...rest] = deltas;
  const recent = [latest, ...rest].slice(0, 5);

  return (
    <SurfaceCard level={2}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Microscope className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />
          <span className="text-sm font-semibold text-text">Deep-Eval Scan Regressions</span>
          <span
            className="text-2xs font-medium px-1.5 py-0.5 rounded ml-1"
            style={{ color: STATUS_INFO, backgroundColor: `${STATUS_INFO}${OPACITY_10}` }}
          >
            source: code quality
          </span>
        </div>
        <p className="text-xs text-text-muted mb-3">
          New vs resolved findings across recent module deep-eval scans — distinct from playtest sessions.
        </p>

        {/* Latest-scan summary */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <DeltaStat label="New" value={latest.newTotal} color={STATUS_WARNING} />
          <DeltaStat label="Resolved" value={latest.resolvedTotal} color={STATUS_SUCCESS} />
          <DeltaStat label="Persisting" value={latest.persistingTotal} color={STATUS_BLOCKER} />
        </div>

        {/* Per-scan trend rows */}
        <div className="space-y-1.5">
          {recent.map((d) => (
            <div
              key={d.scanId}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background text-2xs"
            >
              <span className="text-text-muted flex-shrink-0">
                {new Date(d.timestamp).toLocaleString()}
              </span>
              <span className="text-text-muted truncate flex-1">
                {d.hasPrevious
                  ? `${d.modulesEvaluated.length} module${d.modulesEvaluated.length !== 1 ? 's' : ''} re-evaluated`
                  : 'baseline scan'}
              </span>
              <span
                className="flex items-center gap-0.5 font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_10}` }}
                title={`${d.newTotal} new finding${d.newTotal !== 1 ? 's' : ''}`}
              >
                <ArrowUpRight className="w-3 h-3" />
                {d.newTotal}
              </span>
              <span
                className="flex items-center gap-0.5 font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}` }}
                title={`${d.resolvedTotal} resolved finding${d.resolvedTotal !== 1 ? 's' : ''}`}
              >
                <ArrowDownRight className="w-3 h-3" />
                {d.resolvedTotal}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

function DeltaStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="px-2.5 py-2 rounded-md text-center"
      style={{ backgroundColor: `${color}${OPACITY_10}`, border: `1px solid ${color}${OPACITY_20}` }}
    >
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
