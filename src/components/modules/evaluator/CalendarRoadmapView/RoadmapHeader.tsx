'use client';

import { Dispatch, SetStateAction } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_INFO } from '@/lib/chart-colors';
import type { ProjectHealthSummary } from '@/types/project-health';

interface RoadmapHeaderProps {
  summary: ProjectHealthSummary | null;
  setScrollOffset: Dispatch<SetStateAction<number>>;
}

export function RoadmapHeader({ summary, setScrollOffset }: RoadmapHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5" style={{ color: STATUS_INFO }} />
        <h2 className="text-base font-semibold text-text">Calendar Roadmap</h2>
        {summary && (
          <span className="text-xs text-text-muted">
            {summary.overallCompletion}% complete
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setScrollOffset((p) => p - 4)}
          className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScrollOffset(0)}
          className="px-2 py-1 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => setScrollOffset((p) => p + 4)}
          className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
