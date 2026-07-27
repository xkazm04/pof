import { BarChart3, GitBranch, FlaskConical, Trophy, TrendingUp } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/Badge';
import type { EvolutionStats, PromptVersionFitness } from '@/types/prompt-evolution';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';
import { ACCENT, STATUS_COLORS, type ViewMode } from './constants';
import { EmptyState } from './EmptyState';
import { JudgeFitnessStrip } from './JudgeFitnessStrip';

// ── Stats Panel ─────────────────────────────────────────────────────────────

export function StatsPanel({
  stats,
  promptFitness = [],
  mode = 'advanced',
}: {
  stats: EvolutionStats;
  /** Judge-scored quality per quality-pack prompt version; empty → the strip hides. */
  promptFitness?: PromptVersionFitness[];
  mode?: ViewMode;
}) {
  return (
    <div className="space-y-4">
      <JudgeFitnessStrip fitness={promptFitness} mode={mode} />
      {/* Global stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Variants" value={stats.totalVariants} icon={GitBranch} />
        <StatCard label="Active Tests" value={stats.activeABTests} icon={FlaskConical} color={STATUS_COLORS.running} />
        <StatCard label="Concluded" value={stats.concludedABTests} icon={Trophy} color={STATUS_COLORS.concluded} />
        <StatCard
          label="Avg Improvement"
          value={`${stats.avgImprovementRate > 0 ? '+' : ''}${Math.round(stats.avgImprovementRate * 100)}%`}
          icon={TrendingUp}
          color={stats.avgImprovementRate > 0 ? ACCENT : STATUS_NEUTRAL}
        />
      </div>

      {/* Module breakdown */}
      {stats.moduleBreakdown.length > 0 ? (
        <SurfaceCard level={2} className="p-4">
          <h3 className="text-xs font-medium text-text mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            Module Breakdown
          </h3>
          <div className="space-y-2">
            {stats.moduleBreakdown.map((m) => (
              <div key={m.moduleId} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-xs text-text w-28 truncate">{m.moduleId}</span>
                <Badge variant="default" className="text-[11px]">{m.variants} var</Badge>
                <Badge variant="default" className="text-[11px]">{m.activeTests} tests</Badge>
                <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(m.bestSuccessRate * 100, 2)}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                </div>
                <span className="text-xs text-text-muted w-12 text-right">
                  {Math.round(m.bestSuccessRate * 100)}%
                </span>
                {m.improvement > 0 && (
                  <span className="text-xs font-medium" style={{ color: ACCENT }}>
                    +{Math.round(m.improvement * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No evolution data yet"
          description="Create prompt variants and run A/B tests to see per-module improvement stats"
        />
      )}

      {stats.topPerformingModule && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface/50">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-xs text-text">
            Top performing module: <strong>{stats.topPerformingModule}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = ACCENT,
}: {
  label: string;
  value: number | string;
  icon: typeof BarChart3;
  color?: string;
}) {
  return (
    <KPICard
      layout="vertical"
      icon={<Icon className="w-3.5 h-3.5" style={{ color }} />}
      label={label}
      value={value}
    />
  );
}
