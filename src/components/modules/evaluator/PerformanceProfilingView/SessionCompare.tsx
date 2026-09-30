'use client';

import { GitCompareArrows, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { CompareOverall, MetricDelta, SessionComparisonResponse } from '@/lib/profiling/session-compare';
import { FindingsSection } from './FindingsSection';

// ── Session Compare ─────────────────────────────────────────────────────────
// Before/after: direction-aware metric deltas plus the findings resolved,
// introduced and persisting between a baseline (A) and a head (B) capture.

const OVERALL: Record<CompareOverall, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  improved: { label: 'Improved', variant: 'success' },
  regressed: { label: 'Regressed', variant: 'error' },
  mixed: { label: 'Mixed', variant: 'warning' },
  unchanged: { label: 'Unchanged', variant: 'default' },
  'not-comparable': { label: 'Not comparable', variant: 'default' },
};

function withUnit(text: string, unit: string): string {
  if (!unit) return text;
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

/** Signed, so a reader never has to infer the direction from colour alone. */
function signedDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '±';
  return withUnit(`${sign}${Math.abs(delta).toFixed(1)}`, unit);
}

function Verdict({ better }: { better: MetricDelta['better'] }) {
  if (better === true) return <span className="text-emerald-400">better</span>;
  if (better === false) return <span className="text-red-400">worse</span>;
  return <span className="text-text-muted">no verdict</span>;
}

export function SessionCompare({ comparison, onClose }: {
  comparison: SessionComparisonResponse;
  onClose: () => void;
}) {
  const { base, head, metrics, findings, introducedFindings, realizedSavingsMs } = comparison;
  const overall = OVERALL[comparison.overall];

  return (
    <SurfaceCard className="p-4" aria-label="Session comparison">
      <div className="flex items-center gap-2 mb-3">
        <GitCompareArrows className="w-4 h-4 text-rose-400" />
        <h2 className="text-sm font-medium text-text">Before / after</h2>
        <span className="text-2xs text-text-muted truncate">
          A {base.name} (score {base.overallScore}) → B {head.name} (score {head.overallScore})
        </span>
        <Badge variant={overall.variant}>{overall.label}</Badge>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Close comparison"
          onClick={onClose}
          className="focus-ring p-1 rounded text-text-muted hover:text-text transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!comparison.comparable && comparison.reason && (
        <p role="note" className="mb-3 flex items-center gap-1.5 px-2 py-1.5 rounded border border-amber-400/20 bg-amber-400/5 text-2xs text-amber-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {comparison.reason}
        </p>
      )}

      <table className="w-full text-xs mb-3">
        <caption className="sr-only">Metric deltas from A to B</caption>
        <thead>
          <tr className="text-2xs text-text-muted text-left">
            <th scope="col" className="font-medium py-1">Metric</th>
            <th scope="col" className="font-medium py-1 text-right">A</th>
            <th scope="col" className="font-medium py-1 text-right">B</th>
            <th scope="col" className="font-medium py-1 text-right">Δ</th>
            <th scope="col" className="font-medium py-1 text-right">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} className="border-t border-border">
              <th scope="row" className="font-normal text-left text-text py-1">{m.label}</th>
              <td className="text-right font-mono text-text-muted">{m.base.toFixed(1)}</td>
              <td className="text-right font-mono text-text">{m.head.toFixed(1)}</td>
              <td className="text-right font-mono text-text">{signedDelta(m.delta, m.unit)}</td>
              <td className="text-right text-2xs"><Verdict better={m.better} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-2 mb-2 text-xs text-text">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>{`resolved ${findings.resolved.length} · introduced ${findings.introduced.length} · persisting ${findings.persisting.length}`}</span>
        {realizedSavingsMs > 0 && (
          <span className="text-2xs text-emerald-400">~{realizedSavingsMs.toFixed(1)} ms realized</span>
        )}
      </div>

      {findings.resolved.length > 0 && (
        <ul aria-label="Resolved findings" className="flex flex-wrap gap-1 mb-2">
          {comparison.resolvedFindings.map((f, i) => (
            <li key={`${f.id}#${i}`} className="px-1.5 py-0.5 rounded border border-emerald-400/20 bg-emerald-400/5 text-2xs text-emerald-400">
              {f.title}
            </li>
          ))}
        </ul>
      )}

      {findings.persisting.length > 0 && (
        <ul aria-label="Persisting findings" className="space-y-0.5 mb-2">
          {findings.persisting.map((p, i) => (
            <li key={`${p.id}#${i}`} className="flex items-center gap-2 text-2xs text-text-muted">
              <span className="truncate text-text">{p.title ?? p.id}</span>
              <span className="font-mono">{p.metric}: {p.baseValue} → {p.headValue} ({signedDelta(p.metricDelta, '')})</span>
            </li>
          ))}
        </ul>
      )}

      {introducedFindings.length > 0 && (
        <div className="mt-3">
          <div className="text-2xs text-text-muted mb-1">Introduced in B</div>
          <FindingsSection findings={introducedFindings} />
        </div>
      )}
    </SurfaceCard>
  );
}
