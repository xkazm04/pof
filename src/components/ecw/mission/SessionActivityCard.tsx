'use client';

import { useMemo } from 'react';
import { Terminal } from 'lucide-react';
import { useCRUD } from '@/hooks/useCRUD';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import type { AnalyticsDashboard } from '@/types/session-analytics';

const EMPTY: AnalyticsDashboard = {
  totalSessions: 0,
  overallSuccessRate: 0,
  totalDurationMs: 0,
  moduleStats: [],
  insights: [],
  qualityScores: [],
  recentSessions: [],
};

const TOP_COUNT = 3;

/**
 * Mission Control CLI-session activity (ECW Phase 10-MC — folds in the legacy
 * DirectorOverview / UnifiedSummary session signal). Reads
 * `/api/session-analytics?action=dashboard` and shows total CLI throughput, the
 * overall success rate, and the most-active modules with their success rates.
 */
export function SessionActivityCard() {
  const { data, isLoading } = useCRUD<AnalyticsDashboard>('/api/session-analytics?action=dashboard', EMPTY);

  const model = useMemo(() => {
    const successPct = Math.round((data.overallSuccessRate ?? 0) * 100);
    const topModules = [...(data.moduleStats ?? [])]
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, TOP_COUNT);
    return { totalSessions: data.totalSessions ?? 0, successPct, topModules };
  }, [data]);

  return (
    <section className="rounded-lg border border-border/40 bg-surface-deep p-4">
      <header className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text">CLI Activity</h2>
        {model.totalSessions > 0 && (
          <span className="ml-auto text-2xs font-mono" style={{ color: model.successPct >= 60 ? STATUS_SUCCESS : STATUS_ERROR }}>
            {model.successPct}% success
          </span>
        )}
      </header>

      {isLoading && model.totalSessions === 0 ? (
        <p className="text-2xs font-mono text-text-muted/60">Loading sessions…</p>
      ) : model.totalSessions === 0 ? (
        <p className="text-2xs font-mono text-text-muted/60">
          No CLI sessions recorded yet. Dispatch work from a module or facet to populate activity.
        </p>
      ) : (
        <>
          <div className="text-2xs font-mono text-text-muted mb-3">
            {model.totalSessions} session{model.totalSessions === 1 ? '' : 's'} across {model.topModules.length === TOP_COUNT ? 'top' : 'all'} modules
          </div>
          <div className="space-y-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-text-muted/70">Most active</div>
            {model.topModules.map((m) => {
              const pct = Math.round(m.successRate * 100);
              return (
                <div key={m.moduleId} className="flex items-center gap-2 text-2xs font-mono">
                  <span className="flex-1 truncate text-text-muted">{m.moduleId}</span>
                  <span className="text-text-muted/60">{m.totalSessions}×</span>
                  <div className="w-20 h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct >= 60 ? STATUS_SUCCESS : STATUS_ERROR }} />
                  </div>
                  <span className="w-7 text-right text-text">{pct}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
