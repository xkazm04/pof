import { AlertTriangle } from 'lucide-react';
import { SEVERITY_TOKENS, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import type { RegressionAlert } from '@/lib/ue5-bridge/build-health';

export function RegressionBanner({ regressions }: { regressions: RegressionAlert[] }) {
  return (
    <div data-testid="build-health-regressions" className="space-y-2">
      {regressions.map((r) => {
        const token = r.severity === 'critical' ? SEVERITY_TOKENS.critical : SEVERITY_TOKENS.warning;
        return (
          <div
            key={`${r.kind}-${r.buildId}`}
            data-regression-kind={r.kind}
            data-regression-severity={r.severity}
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: token.bg, border: `1px solid ${token.border}` }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: token.color }}>
                  {r.kind === 'duration' ? 'Build slowdown' : 'Error spike'} regression
                </span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
                  style={{ backgroundColor: withOpacity(token.color, OPACITY_10), color: token.color }}
                >
                  {r.severity}
                </span>
                <span className="text-2xs font-mono text-text-muted">+{r.deltaPct}%</span>
              </div>
              <p className="text-xs text-text-muted-hover leading-relaxed mt-0.5">{r.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
