import { motion } from 'framer-motion';
import { Clock, TrendingUp } from 'lucide-react';
import { formatEffortTime } from '@/lib/implementation-planner/effort-estimator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_STALE } from '@/lib/chart-colors';
import type { ImplementationPlan } from '@/lib/implementation-planner/plan-generator';

export function SummaryCards({
  plan,
  progress,
  readyCount,
}: {
  plan: ImplementationPlan;
  progress: number;
  readyCount: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Progress bar */}
      <SurfaceCard level={2} className="col-span-2 px-3 py-2.5 border-l-2" style={{ borderLeftColor: MODULE_COLORS.core }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Progress</span>
          <span className="text-xs font-bold text-text">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundImage: `linear-gradient(to right, ${MODULE_COLORS.core}, ${STATUS_STALE})` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45 }}
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
  );
}
