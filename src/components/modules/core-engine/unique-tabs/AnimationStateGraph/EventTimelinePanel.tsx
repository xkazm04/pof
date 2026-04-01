'use client';

import { STATUS_INFO, STATUS_WARNING, ACCENT_EMERALD } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { TimelineStrip } from '../_shared';
import { ACCENT, ANIMATION_TIMELINE_EVENTS } from './data';

export function EventTimelinePanel() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Animation Event Timeline" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        10-second event log showing state changes, montage plays, and notify fires.
      </p>
      <div>
        <TimelineStrip events={ANIMATION_TIMELINE_EVENTS} accent={ACCENT} height={80} />
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs font-medium text-text-muted border-t border-border/40 pt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_INFO }} />
            State change
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
            Montage play
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />
            Notify fire
          </span>
        </div>
      </div>
    </BlueprintPanel>
  );
}
