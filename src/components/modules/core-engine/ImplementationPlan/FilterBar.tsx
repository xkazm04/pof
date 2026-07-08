import { Filter } from 'lucide-react';
import { type EffortLevel } from '@/lib/implementation-planner/effort-estimator';
import { getModuleLabel } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';

// ---------- Filter bar ----------

export function FilterBar({
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
  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted outline-none focus:border-blue-500/50';
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
          <option key={id} value={id}>{getModuleLabel(id as SubModuleId)}</option>
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
