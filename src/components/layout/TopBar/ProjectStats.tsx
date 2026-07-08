'use client';

import { useMemo } from 'react';
import { useModuleStore } from '@/stores/moduleStore';
import { CheckCircle2 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import {
  MODULE_CHECKLIST_COUNTS,
  TOTAL_CHECKLIST_ITEMS,
  MODULE_ITEM_IDS,
  EMPTY_PROGRESS,
} from './constants';

export function ProjectStats() {
  const checklistProgress = useModuleStore((s) => s.checklistProgress) || EMPTY_PROGRESS;

  const stats = useMemo(() => {
    let completed = 0;
    let modulesComplete = 0;

    for (const { moduleId, total } of MODULE_CHECKLIST_COUNTS) {
      const progress = checklistProgress[moduleId];
      if (!progress) continue;

      const itemIds = MODULE_ITEM_IDS[moduleId];
      let moduleCompleted = 0;
      for (const id of itemIds) {
        if (progress[id]) {
          completed++;
          moduleCompleted++;
        }
      }
      if (moduleCompleted === total) modulesComplete++;
    }

    const pct = TOTAL_CHECKLIST_ITEMS > 0
      ? Math.round((completed / TOTAL_CHECKLIST_ITEMS) * 100)
      : 0;

    return { completed, total: TOTAL_CHECKLIST_ITEMS, pct, modulesComplete };
  }, [checklistProgress]);

  if (TOTAL_CHECKLIST_ITEMS === 0) return null;

  const barColor = stats.pct >= 75 ? MODULE_COLORS.setup : stats.pct >= 40 ? MODULE_COLORS.content : 'var(--text-muted)';

  return (
    <div className="flex items-center gap-2.5" title={`${stats.completed}/${stats.total} checklist items · ${stats.modulesComplete} modules complete`}>
      {/* Mini progress bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-slow"
            style={{ width: `${stats.pct}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="text-2xs font-medium tabular-nums" style={{ color: barColor }}>
          {stats.pct}%
        </span>
      </div>
      {/* Fraction */}
      <span className="text-2xs text-text-muted tabular-nums">
        {stats.completed}/{stats.total}
      </span>
      {/* Modules at 100% */}
      {stats.modulesComplete > 0 && (
        <span className="flex items-center gap-0.5 text-2xs" style={{ color: MODULE_COLORS.setup }}>
          <CheckCircle2 className="w-3 h-3" />
          {stats.modulesComplete}
        </span>
      )}
    </div>
  );
}
