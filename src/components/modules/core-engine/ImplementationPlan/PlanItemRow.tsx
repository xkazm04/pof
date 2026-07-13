import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { getModuleLabel, type PlanItem } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';
import { STATUS_STYLES } from './constants';
import { EffortBadge, ImpactBadge, ModuleBadge } from './Badges';

export function PlanItemRow({
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
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="pl-12 pr-3 pb-2.5 space-y-2">
              {/* Description */}
              <p className="text-xs text-text-muted leading-relaxed">
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
                          {mod !== item.moduleId ? `${getModuleLabel(mod as SubModuleId)} / ` : ''}{feat}
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
                          {getModuleLabel(mod as SubModuleId)} / {feat}
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

              {/* Execute affordance — gated on readiness (all deps implemented).
                  A blocked item cannot be dispatched; it explains why instead. */}
              {item.isReady ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExecute(item);
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  Build this
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title={`Blocked — ${item.dependsOn.length} dependenc${item.dependsOn.length === 1 ? 'y' : 'ies'} not yet implemented`}
                  className="flex items-center gap-1 text-xs font-medium text-text-muted bg-surface-hover/40 px-2.5 py-1 rounded cursor-not-allowed"
                >
                  <Link2 className="w-3 h-3" />
                  Blocked by {item.dependsOn.length} dep{item.dependsOn.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
