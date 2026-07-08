import { Zap, Clock } from 'lucide-react';
import { formatEffortTime, type EffortLevel } from '@/lib/implementation-planner/effort-estimator';
import { getModuleLabel } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';
import { EFFORT_COLORS } from './constants';

export function EffortBadge({ level, minutes }: { level: EffortLevel; minutes: number }) {
  const style = EFFORT_COLORS[level];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-2xs font-medium ${style.bg} ${style.text}`}>
      <Clock className="w-2.5 h-2.5" />
      {formatEffortTime(minutes)}
    </span>
  );
}

export function ImpactBadge({ score, directUnblocks }: { score: number; directUnblocks: number }) {
  const color = score >= 6 ? 'text-purple-400 bg-purple-500/15'
    : score >= 3 ? 'text-blue-400 bg-blue-500/15'
    : score >= 1 ? 'text-text-muted bg-surface-hover'
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

export function ModuleBadge({ moduleId }: { moduleId: SubModuleId }) {
  return (
    <span className="text-2xs font-mono px-1.5 py-px rounded bg-surface-hover text-text-muted-hover flex-shrink-0">
      {getModuleLabel(moduleId)}
    </span>
  );
}
