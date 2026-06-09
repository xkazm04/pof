'use client';

import { useMemo } from 'react';
import {
  Coins, Activity, ArrowDown, ArrowUp, TrendingUp, CheckCircle, XCircle, Layers, Wrench,
} from 'lucide-react';
import { useSpendDashboard, useBudget } from '@/hooks/useCliSpend';
import { useModuleStore } from '@/stores/moduleStore';
import { FetchError } from '../shared/FetchError';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/ui/KPICard';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MeterBar } from '@/components/ui/MeterBar';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { SpendBudgetPanel } from './SpendBudgetPanel';
import { formatUsd, formatTokens } from '@/lib/cli-spend/format';
import { formatDuration } from '@/lib/format';
import { taskTypeLabel } from '@/lib/cli-spend/preflight';
import { MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO, STATUS_STALE } from '@/lib/chart-colors';
import type { SpendGroupStat, DailySpend, SpendRecord } from '@/types/cli-spend';

const EVALUATOR_ACCENT = MODULE_COLORS.evaluator;

export function SpendDashboard() {
  const { dashboard, isLoading, error, refetch } = useSpendDashboard();
  const { status, isSaving, save } = useBudget(refetch);
  // ROI pairs server-side spend against client-side checklist completions.
  const checklistProgress = useModuleStore((s) => s.checklistProgress);

  const completedByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [moduleId, items] of Object.entries(checklistProgress)) {
      counts[moduleId] = Object.values(items).filter(Boolean).length;
    }
    return counts;
  }, [checklistProgress]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={refetch} />;
  }

  if (!dashboard || dashboard.totalRuns === 0) {
    return (
      <div className="space-y-4">
        <SpendBudgetPanel status={status} isSaving={isSaving} onSave={save} />
        <EmptyState
          icon={Coins}
          title="No spend recorded yet"
          description="Run CLI tasks from any module to start tracking cost and token usage. Each run's cost and tokens are captured automatically and rolled up here by module and task type."
          iconColor={EVALUATOR_ACCENT}
        />
      </div>
    );
  }

  const maxDaily = Math.max(...dashboard.daily.map((d) => d.costUsd), 0.0001);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard layout="vertical" accent={STATUS_SUCCESS} icon={<Coins className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />} label="Total Cost" value={formatUsd(dashboard.totalCostUsd)} />
        <KPICard layout="vertical" accent={STATUS_INFO} icon={<Activity className="w-3 h-3" style={{ color: STATUS_INFO }} />} label="Total Runs" value={dashboard.totalRuns.toString()} />
        <KPICard layout="vertical" accent={STATUS_STALE} icon={<ArrowDown className="w-3 h-3" style={{ color: STATUS_STALE }} />} label="Tokens In" value={formatTokens(dashboard.totalTokensIn)} />
        <KPICard layout="vertical" accent={MODULE_COLORS.content} icon={<ArrowUp className="w-3 h-3" style={{ color: MODULE_COLORS.content }} />} label="Tokens Out" value={formatTokens(dashboard.totalTokensOut)} />
      </div>

      {/* Budget guard */}
      <SpendBudgetPanel status={status} isSaving={isSaving} onSave={save} />

      {/* Daily spend trend */}
      {dashboard.daily.length > 0 && (
        <Section title="Daily spend" subtitle="Cost per day over the last 30 days of activity.">
          <DailyTrend daily={dashboard.daily} max={maxDaily} />
        </Section>
      )}

      {/* Per-module */}
      {dashboard.byModule.length > 0 && (
        <Section title="Cost by module" subtitle="Which game systems are cheapest vs. most expensive to build.">
          <GroupTable groups={dashboard.byModule} total={dashboard.totalCostUsd} labelFor={(k) => k} />
        </Section>
      )}

      {/* Per-task-type */}
      {dashboard.byTaskType.length > 0 && (
        <Section title="Cost by task type" subtitle="Spend grouped by the kind of CLI task (scans, checklist runs, live editor runs, …).">
          <GroupTable groups={dashboard.byTaskType} total={dashboard.totalCostUsd} labelFor={taskTypeLabel} />
        </Section>
      )}

      {/* ROI */}
      {dashboard.byModule.length > 0 && (
        <Section title="Per-module ROI" subtitle="Cost paired with checklist items completed in each module — your build's cost-per-outcome.">
          <RoiTable groups={dashboard.byModule} completedByModule={completedByModule} />
        </Section>
      )}

      {/* Recent runs */}
      {dashboard.recent.length > 0 && (
        <Section title="Recent runs" subtitle="Your most recent CLI runs, newest first.">
          <div className="space-y-0.5">
            {dashboard.recent.map((r) => (
              <RecentRunRow key={r.id} run={r} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Sub-components ──

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-text">{title}</h3>
        <p className="text-2xs text-text-muted mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function DailyTrend({ daily, max }: { daily: DailySpend[]; max: number }) {
  return (
    <SurfaceCard level={2} className="px-4 py-3">
      <div className="flex items-end gap-1 h-24" role="img" aria-label="Daily spend bar chart">
        {daily.map((d) => {
          const pct = Math.max(2, (d.costUsd / max) * 100);
          return (
            <Tooltip key={d.day} content={`${d.day}: ${formatUsd(d.costUsd)} · ${d.runs} run${d.runs === 1 ? '' : 's'}`}>
              <div className="flex-1 h-full flex items-end" tabIndex={0}>
                <div
                  className="w-full rounded-t transition-all"
                  style={{ height: `${pct}%`, backgroundColor: EVALUATOR_ACCENT, minWidth: 3 }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-2xs text-text-muted">
        <span>{daily[0]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </SurfaceCard>
  );
}

function GroupTable({
  groups,
  total,
  labelFor,
}: {
  groups: SpendGroupStat[];
  total: number;
  labelFor: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      {groups.map((g, i) => {
        const share = total > 0 ? (g.costUsd / total) * 100 : 0;
        return (
          <div key={g.key} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors">
            <TruncateWithTooltip className="text-xs text-text w-40 truncate">{labelFor(g.key)}</TruncateWithTooltip>
            <div className="flex-1 flex items-center gap-2">
              <MeterBar value={share} color={EVALUATOR_ACCENT} delayMs={i * 40} ariaLabel={`${labelFor(g.key)} cost share`} valueText={`${Math.round(share)}% of total cost`} className="flex-1" height={5} />
              <span className="text-xs font-semibold text-text w-16 text-right tabular-nums">{formatUsd(g.costUsd)}</span>
            </div>
            <span className="text-2xs text-text-muted w-12 text-right tabular-nums" title="Runs">{g.runs} run{g.runs === 1 ? '' : 's'}</span>
            <span className="text-2xs text-text-muted w-24 text-right tabular-nums" title="Tokens in / out">
              {formatTokens(g.tokensIn)}/{formatTokens(g.tokensOut)}
            </span>
            <span className="text-2xs text-text-muted w-16 text-right tabular-nums" title="Average cost per run">~{formatUsd(g.avgCostUsd)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RoiTable({
  groups,
  completedByModule,
}: {
  groups: SpendGroupStat[];
  completedByModule: Record<string, number>;
}) {
  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-1 text-2xs text-text-muted uppercase tracking-wider">
        <span className="w-40">Module</span>
        <span className="flex-1 text-right">Cost</span>
        <span className="w-20 text-right">Done items</span>
        <span className="w-24 text-right">Cost / item</span>
      </div>
      {groups.map((g) => {
        const done = completedByModule[g.key] ?? 0;
        const perItem = done > 0 ? g.costUsd / done : null;
        return (
          <div key={g.key} className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-surface-hover transition-colors">
            <div className="w-40 flex items-center gap-1.5 min-w-0">
              <Layers className="w-3 h-3 flex-shrink-0 text-text-muted" aria-hidden="true" />
              <TruncateWithTooltip className="text-xs text-text truncate">{g.key}</TruncateWithTooltip>
            </div>
            <span className="flex-1 text-right text-xs text-text tabular-nums">{formatUsd(g.costUsd)}</span>
            <span className="w-20 text-right text-xs text-text-muted-hover tabular-nums">{done}</span>
            <span className="w-24 text-right text-xs tabular-nums" style={{ color: perItem == null ? 'var(--text-muted)' : STATUS_SUCCESS }}>
              {perItem == null ? '—' : formatUsd(perItem)}
            </span>
          </div>
        );
      })}
      <p className="text-2xs text-text-muted px-3 pt-1 flex items-center gap-1">
        <TrendingUp className="w-2.5 h-2.5" /> Lower cost-per-item means more checklist progress per dollar. Modules with no completed items show “—”.
      </p>
    </div>
  );
}

function RecentRunRow({ run }: { run: SpendRecord }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-surface-hover transition-colors">
      {run.success ? (
        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-label="Run succeeded" />
      ) : (
        <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} aria-label="Run failed" />
      )}
      <TruncateWithTooltip className="text-xs text-text-muted-hover w-28 truncate flex-shrink-0">{run.moduleId}</TruncateWithTooltip>
      <span className="flex items-center gap-1 text-2xs text-text-muted w-32 flex-shrink-0 truncate">
        <Wrench className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
        {taskTypeLabel(run.taskType)}
      </span>
      <span className="flex-1" />
      <span className="text-2xs text-text-muted tabular-nums" title="Tokens in / out">
        {formatTokens(run.tokensIn)}/{formatTokens(run.tokensOut)}
      </span>
      <span className="text-2xs text-text-muted tabular-nums w-12 text-right">{formatDuration(run.durationMs)}</span>
      <span className="text-xs font-semibold text-text tabular-nums w-16 text-right">{formatUsd(run.costUsd)}</span>
    </div>
  );
}
