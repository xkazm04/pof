import type { WeeklyDigest } from '@/types/weekly-digest';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { SparklineBar } from './SparklineBar';

// ── Daily activity sparkline ─────────────────────────────────────────────────

export function DailyActivity({ dailySessions }: { dailySessions: WeeklyDigest['dailySessions'] }) {
  return (
    <div className="px-4 py-3 rounded-lg bg-surface border border-border">
      <p className="text-2xs text-text-muted mb-2">Daily activity</p>
      <div className="flex items-end gap-1.5 h-12">
        {dailySessions.map((d) => {
          const maxSessions = Math.max(...dailySessions.map((x) => x.total), 1);
          const height = d.total > 0 ? Math.max(4, (d.total / maxSessions) * 48) : 2;
          const rate = d.total > 0 ? d.success / d.total : 0;
          const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'long' });
          const pct = d.total > 0 ? Math.round(rate * 100) : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <SparklineBar
                height={height}
                isEmpty={d.total === 0}
                color={d.total === 0
                  ? 'var(--border)'
                  : rate >= 0.75 ? MODULE_COLORS.setup : rate >= 0.5 ? MODULE_COLORS.content : MODULE_COLORS.evaluator}
                dayName={dayName}
                total={d.total}
                success={d.success}
                pct={pct}
              />
              <span className="text-2xs text-text-muted leading-none">
                {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' })}
              </span>
              {d.total > 0 && (
                <span className="text-[9px] tabular-nums text-text-muted leading-none">{pct}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
