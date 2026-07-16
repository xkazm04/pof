import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { WeeklyDigest } from '@/types/weekly-digest';
import { MODULE_COLORS } from '@/lib/chart-colors';

// ── Module leaderboard ───────────────────────────────────────────────────────

export function ModuleLeaderboard({ moduleActivity }: { moduleActivity: WeeklyDigest['moduleActivity'] }) {
  return (
    <div className="px-4 py-3 rounded-lg bg-surface border border-border">
      <p className="text-2xs text-text-muted mb-2">Module activity</p>
      <div className="space-y-1.5">
        {moduleActivity.slice(0, 8).map((m, i) => {
          // Don't assume index 0 is the max — input isn't guaranteed sorted.
          const maxSessions = Math.max(...moduleActivity.map((a) => a.sessions), 1);
          const barWidth = maxSessions > 0 ? (m.sessions / maxSessions) * 100 : 0;
          return (
            <div key={m.moduleId} className="flex items-center gap-2">
              <span className="w-4 text-2xs text-text-muted text-right tabular-nums">{i + 1}</span>
              <span className="text-xs text-text w-32 truncate">{m.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: m.successRate >= 0.75 ? MODULE_COLORS.setup : m.successRate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator,
                  }}
                />
              </div>
              <span className="text-2xs text-text-muted tabular-nums w-8 text-right">{m.sessions}</span>
              <span className="flex items-center gap-0.5 w-14 justify-end" style={{
                color: m.successRate >= 0.75 ? MODULE_COLORS.setup : m.successRate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator,
              }}>
                {m.successRate >= 0.75
                  ? <CheckCircle className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                  : m.successRate >= 0.5
                    ? <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                    : <XCircle className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                }
                <span className="text-2xs tabular-nums">{Math.round(m.successRate * 100)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
