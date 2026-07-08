import { useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import { AVAILABLE_MODULES } from './constants';

// ── Module Selector ──────────────────────────────────────────────────────────

export function ModuleSelector({
  selected,
  onToggle,
  onStart,
}: {
  selected: string[];
  onToggle: (id: SubModuleId) => void;
  onStart: () => void;
}) {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      // Deselect all
      for (const m of selected) onToggle(m as SubModuleId);
    } else {
      for (const m of AVAILABLE_MODULES) {
        if (!selected.includes(m)) onToggle(m);
      }
    }
    setSelectAll(!selectAll);
  }, [selectAll, selected, onToggle]);

  return (
    <SurfaceCard className="p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-text">Select Module(s)</span>
        <div className="flex-1" />
        <button
          onClick={handleSelectAll}
          className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {selectAll ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {AVAILABLE_MODULES.map((moduleId) => {
          const isActive = selected.includes(moduleId);
          return (
            <button
              key={moduleId}
              onClick={() => onToggle(moduleId)}
              className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                  : 'bg-surface border-border text-text-muted hover:text-text hover:border-border-bright'
              }`}
            >
              {moduleId}
            </button>
          );
        })}
      </div>

      <button
        onClick={onStart}
        disabled={selected.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-3.5 h-3.5" />
        Start Workflow ({selected.length} module{selected.length !== 1 ? 's' : ''})
      </button>
    </SurfaceCard>
  );
}
