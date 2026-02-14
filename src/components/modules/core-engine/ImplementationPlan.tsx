'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListOrdered, Zap, Clock, ArrowRight, Filter, RefreshCw,
  ChevronDown, ChevronRight, Link2, CheckCircle, Circle,
  Target, TrendingUp, AlertCircle,
} from 'lucide-react';
import { useImplementationPlan } from '@/hooks/useImplementationPlan';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { buildProjectContextHeader } from '@/lib/prompt-context';
import { formatEffortTime, type EffortLevel } from '@/lib/implementation-planner/effort-estimator';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

// ---------- Constants ----------

const EFFORT_COLORS: Record<EffortLevel, { bg: string; text: string }> = {
  trivial: { bg: 'bg-green-500/15', text: 'text-green-400' },
  small: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  large: { bg: 'bg-red-500/15', text: 'text-red-400' },
};

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle; color: string }> = {
  partial: { icon: AlertCircle, color: 'text-yellow-400' },
  missing: { icon: Circle, color: 'text-red-400' },
  unknown: { icon: Circle, color: 'text-text-muted' },
};

const PAGE_SIZE = 25;

// ---------- Sub-components ----------

function EffortBadge({ level, minutes }: { level: EffortLevel; minutes: number }) {
  const style = EFFORT_COLORS[level];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-2xs font-medium ${style.bg} ${style.text}`}>
      <Clock className="w-2.5 h-2.5" />
      {formatEffortTime(minutes)}
    </span>
  );
}

function ImpactBadge({ score, directUnblocks }: { score: number; directUnblocks: number }) {
  const color = score >= 6 ? 'text-purple-400 bg-purple-500/15'
    : score >= 3 ? 'text-blue-400 bg-blue-500/15'
    : score >= 1 ? 'text-[#9ca0be] bg-surface-hover'
    : 'text-text-muted bg-surface-hover/50';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-2xs font-medium ${color}`}>
      <Zap className="w-2.5 h-2.5" />
      {score > 0 ? `${score} impact` : 'leaf'}
      {directUnblocks > 0 && (
        <span className="text-2xs opacity-70">({directUnblocks} direct)</span>
      )}
    </span>
  );
}

function ModuleBadge({ moduleId }: { moduleId: string }) {
  return (
    <span className="text-2xs font-mono px-1.5 py-px rounded bg-surface-hover text-text-muted-hover flex-shrink-0">
      {getModuleLabel(moduleId)}
    </span>
  );
}

function PlanItemRow({
  item,
  rank,
  onExecute,
}: {
  item: PlanItem;
  rank: number;
  onExecute: (item: PlanItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.unknown;
  const StatusIcon = statusStyle.icon;

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors"
      >
        {/* Rank number */}
        <span className="text-xs font-mono text-text-muted w-5 text-right flex-shrink-0 mt-0.5">
          {rank}
        </span>

        {/* Status icon */}
        <StatusIcon className={`w-3.5 h-3.5 ${statusStyle.color} flex-shrink-0 mt-0.5`} />

        {/* Expand chevron */}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }

        {/* Feature info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-text truncate">
              {item.featureName}
            </span>
            <ModuleBadge moduleId={item.moduleId} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <EffortBadge level={item.effort.level} minutes={item.effort.minutes} />
            <ImpactBadge score={item.impact.score} directUnblocks={item.impact.directUnblocks} />
            {item.isReady && (
              <span className="text-2xs font-medium text-green-400 bg-green-500/10 px-1.5 py-px rounded">
                Ready
              </span>
            )}
            {item.dependsOn.length > 0 && !item.isReady && (
              <span className="flex items-center gap-0.5 text-2xs text-text-muted">
                <Link2 className="w-2.5 h-2.5" />
                {item.dependsOn.length} dep{item.dependsOn.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-12 pr-3 pb-2.5 space-y-2">
              {/* Description */}
              <p className="text-xs text-[#9ca0be] leading-relaxed">
                {item.description}
              </p>

              {/* Dependencies */}
              {item.dependsOn.length > 0 && (
                <div>
                  <span className="text-2xs text-text-muted font-medium uppercase tracking-wider">
                    Depends on:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.dependsOn.map((dep) => {
                      const [mod, ...rest] = dep.split('::');
                      const feat = rest.join('::');
                      return (
                        <span
                          key={dep}
                          className={`text-2xs px-1.5 py-px rounded font-mono ${
                            item.isReady
                              ? 'bg-green-500/10 text-green-400/80'
                              : 'bg-surface-hover text-text-muted-hover'
                          }`}
                        >
                          {mod !== item.moduleId ? `${getModuleLabel(mod)} / ` : ''}{feat}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unblocks */}
              {item.impact.directDependents.length > 0 && (
                <div>
                  <span className="text-2xs text-text-muted font-medium uppercase tracking-wider">
                    Unblocks:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.impact.directDependents.slice(0, 8).map((dep) => {
                      const [mod, ...rest] = dep.split('::');
                      const feat = rest.join('::');
                      return (
                        <span key={dep} className="text-2xs px-1.5 py-px rounded bg-purple-500/10 text-purple-400/80 font-mono">
                          {getModuleLabel(mod)} / {feat}
                        </span>
                      );
                    })}
                    {item.impact.directDependents.length > 8 && (
                      <span className="text-2xs text-text-muted">
                        +{item.impact.directDependents.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Effort reason */}
              <div className="text-2xs text-text-muted">
                Effort: {item.effort.reason}
              </div>

              {/* Execute button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute(item);
                }}
                className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                Implement This
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Filter bar ----------

function FilterBar({
  filter,
  onUpdate,
  onClear,
  moduleIds,
}: {
  filter: { moduleId?: string; maxEffort?: EffortLevel; minImpact?: number };
  onUpdate: (f: Partial<typeof filter>) => void;
  onClear: () => void;
  moduleIds: string[];
}) {
  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-[#c8cce0] outline-none focus:border-[#3b82f6]/50';
  const hasFilter = filter.moduleId || filter.maxEffort || (filter.minImpact != null && filter.minImpact > 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3 h-3 text-text-muted" />

      <select
        value={filter.moduleId ?? ''}
        onChange={(e) => onUpdate({ moduleId: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">All modules</option>
        {moduleIds.map((id) => (
          <option key={id} value={id}>{getModuleLabel(id)}</option>
        ))}
      </select>

      <select
        value={filter.maxEffort ?? ''}
        onChange={(e) => onUpdate({ maxEffort: (e.target.value as EffortLevel) || undefined })}
        className={selectClass}
      >
        <option value="">Any effort</option>
        <option value="trivial">Trivial (~15m)</option>
        <option value="small">Small (~30m)</option>
        <option value="medium">Medium (~1h)</option>
        <option value="large">Large (~2h)</option>
      </select>

      <select
        value={filter.minImpact ?? 0}
        onChange={(e) => onUpdate({ minImpact: Number(e.target.value) || undefined })}
        className={selectClass}
      >
        <option value={0}>Any impact</option>
        <option value={1}>Low+</option>
        <option value={3}>Medium+</option>
        <option value={6}>High+</option>
      </select>

      {hasFilter && (
        <button
          onClick={onClear}
          className="text-2xs text-text-muted hover:text-text transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ---------- Main component ----------

export function ImplementationPlan() {
  const { plan, loading, error, filter, updateFilter, clearFilter, refresh } = useImplementationPlan();
  const [page, setPage] = useState(0);
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  // CLI for executing fix operations
  const { sendPrompt } = useModuleCLI({
    moduleId: 'core-engine',
    sessionKey: 'implementation-plan',
    label: 'Implementation Plan',
    accentColor: '#3b82f6',
  });

  const moduleIds = useMemo(() => Object.keys(MODULE_FEATURE_DEFINITIONS), []);

  const handleExecute = useCallback((item: PlanItem) => {
    const header = buildProjectContextHeader({ projectName, projectPath, ueVersion });
    const depsSection = item.dependsOn.length > 0
      ? `\n\n## Dependencies (already implemented)\n${item.dependsOn.map((d) => `- ${d.replace('::', ' / ')}`).join('\n')}`
      : '';

    const prompt = `${header}${depsSection}

## Task: Implement "${item.featureName}" (${getModuleLabel(item.moduleId)})

${item.description}

Implement this feature from scratch. Follow UE5 C++ conventions. Read any existing related files first, then create/modify files as needed. After implementation, verify the build compiles successfully.`;

    sendPrompt(prompt);
  }, [sendPrompt, projectName, projectPath, ueVersion]);

  // Pagination
  const pagedItems = useMemo(() => {
    if (!plan) return [];
    const start = page * PAGE_SIZE;
    return plan.items.slice(start, start + PAGE_SIZE);
  }, [plan, page]);

  const totalPages = plan ? Math.ceil(plan.items.length / PAGE_SIZE) : 0;

  // Progress percentage
  const progress = plan && plan.totalFeatures > 0
    ? (plan.implementedCount / plan.totalFeatures) * 100
    : 0;

  // Ready count (items that can be implemented right now)
  const readyCount = plan?.items.filter((i) => i.isReady).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-sm font-semibold text-text">Implementation Plan</span>
          {plan && (
            <span className="text-xs text-text-muted font-mono">
              {plan.remainingCount} remaining
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Progress & summary */}
      {plan && (
        <div className="grid grid-cols-4 gap-2">
          {/* Progress bar */}
          <SurfaceCard level={2} className="col-span-2 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Progress</span>
              <span className="text-xs font-bold text-text">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xs text-text-muted">
                {plan.implementedCount} / {plan.totalFeatures} features
              </span>
              <span className="text-2xs text-green-400">
                {readyCount} ready now
              </span>
            </div>
          </SurfaceCard>

          {/* Total effort */}
          <SurfaceCard level={2} className="px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Est. Effort</span>
            </div>
            <div className="text-base font-semibold text-text">
              {formatEffortTime(plan.totalEffortMinutes)}
            </div>
            <div className="text-2xs text-text-muted mt-0.5">
              {plan.items.length} tasks
            </div>
          </SurfaceCard>

          {/* Top impact */}
          <SurfaceCard level={2} className="px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-purple-400" />
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Top Impact</span>
            </div>
            {plan.items.length > 0 ? (
              <>
                <div className="text-xs font-medium text-text truncate">
                  {plan.items[0].featureName}
                </div>
                <div className="text-2xs text-purple-400 mt-0.5">
                  Unblocks {plan.items[0].impact.transitiveUnblocks} features
                </div>
              </>
            ) : (
              <div className="text-xs text-text-muted">No tasks</div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        filter={filter}
        onUpdate={updateFilter}
        onClear={clearFilter}
        moduleIds={moduleIds}
      />

      {/* Error state */}
      {error && (
        <div className="text-center text-red-400 text-xs py-4">{error}</div>
      )}

      {/* Plan list */}
      {plan && (
        <div className="rounded border border-border bg-background/60 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-deep border-b border-border text-2xs uppercase tracking-wider text-text-muted font-medium">
            <span className="w-5 text-right">#</span>
            <span className="w-3.5" />
            <span className="w-3" />
            <span className="flex-1">Feature</span>
          </div>

          {pagedItems.length === 0 ? (
            <div className="text-center text-text-muted text-xs py-8">
              {plan.items.length === 0
                ? 'All features are implemented!'
                : 'No features match the current filters.'
              }
            </div>
          ) : (
            pagedItems.map((item, i) => (
              <PlanItemRow
                key={item.key}
                item={item}
                rank={page * PAGE_SIZE + i + 1}
                onExecute={handleExecute}
              />
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-border bg-surface-deep">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="text-xs text-text-muted hover:text-text disabled:opacity-30 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-text-muted font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="text-xs text-text-muted hover:text-text disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && !plan && (
        <div className="flex items-center justify-center gap-2 text-text-muted text-xs py-8">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Generating plan...
        </div>
      )}
    </div>
  );
}
